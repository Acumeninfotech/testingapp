const crypto = require('crypto');
const {
  sql,
  getPool
} = require('../db/pool');

const {
  getAuthConfig
} = require('../config/auth');

const {
  generateOtp,
  hashOtp
} = require('./otp.service');

const {
  deliverOtp
} = require('./otp-delivery.service');

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

function isValidEmail(email) {
  if (!email || email.length > 320) {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

class AuthInputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthInputError';
    this.statusCode = 400;
  }
}

async function requestOtp(rawEmail) {
  const normalizedEmail = normalizeEmail(rawEmail);

  if (!isValidEmail(normalizedEmail)) {
    throw new AuthInputError('Enter a valid email address');
  }

  const {
    otpExpiryMinutes,
    otpResendCooldownSeconds
  } = getAuthConfig();

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  let otpToDeliver = null;
  let deliveryEmail = null;
  let purpose = null;

  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    const userResult = await new sql.Request(transaction)
      .input(
        'NormalizedEmail',
        sql.NVarChar(320),
        normalizedEmail
      )
      .query(`
        SELECT
          UserId,
          Email,
          NormalizedEmail,
          EmailVerified,
          AccountStatus
        FROM dbo.Users WITH (UPDLOCK, HOLDLOCK)
        WHERE NormalizedEmail = @NormalizedEmail
      `);

    let user = userResult.recordset[0];

    if (!user) {
      const createdUserResult = await new sql.Request(transaction)
        .input(
          'Email',
          sql.NVarChar(320),
          normalizedEmail
        )
        .input(
          'NormalizedEmail',
          sql.NVarChar(320),
          normalizedEmail
        )
        .query(`
          INSERT INTO dbo.Users (
            Email,
            NormalizedEmail
          )
          OUTPUT
            inserted.UserId,
            inserted.Email,
            inserted.NormalizedEmail,
            inserted.EmailVerified,
            inserted.AccountStatus
          VALUES (
            @Email,
            @NormalizedEmail
          )
        `);

      user = createdUserResult.recordset[0];
    }

    if (
      user.AccountStatus === 'SUSPENDED' ||
      user.AccountStatus === 'CLOSED'
    ) {
      await transaction.commit();

      return {
        issued: false,
        reason: 'account_unavailable'
      };
    }

    purpose =
      user.EmailVerified &&
      user.AccountStatus === 'ACTIVE'
        ? 'LOGIN'
        : 'REGISTER';

    const cooldownResult = await new sql.Request(transaction)
      .input(
        'UserId',
        sql.UniqueIdentifier,
        user.UserId
      )
      .input(
        'CooldownSeconds',
        sql.Int,
        otpResendCooldownSeconds
      )
      .query(`
        SELECT TOP (1)
          LoginOtpCodeId
        FROM dbo.LoginOtpCodes WITH (UPDLOCK, HOLDLOCK)
        WHERE UserId = @UserId
          AND Purpose IN (N'LOGIN', N'REGISTER')
          AND UsedAtUtc IS NULL
          AND ExpiresAtUtc > SYSUTCDATETIME()
          AND CreatedAtUtc >
              DATEADD(
                SECOND,
                -@CooldownSeconds,
                SYSUTCDATETIME()
              )
        ORDER BY CreatedAtUtc DESC
      `);

    if (cooldownResult.recordset.length > 0) {
      await transaction.commit();

      return {
        issued: false,
        reason: 'cooldown'
      };
    }

    await new sql.Request(transaction)
      .input(
        'UserId',
        sql.UniqueIdentifier,
        user.UserId
      )
      .query(`
        UPDATE dbo.LoginOtpCodes
        SET UsedAtUtc = SYSUTCDATETIME()
        WHERE UserId = @UserId
          AND Purpose IN (N'LOGIN', N'REGISTER')
          AND UsedAtUtc IS NULL
      `);

    const otp = generateOtp();

    const codeHash = hashOtp({
      userId: user.UserId,
      purpose,
      otp
    });

    await new sql.Request(transaction)
      .input(
        'UserId',
        sql.UniqueIdentifier,
        user.UserId
      )
      .input(
        'Purpose',
        sql.NVarChar(30),
        purpose
      )
      .input(
        'CodeHash',
        sql.NVarChar(255),
        codeHash
      )
      .input(
        'ExpiryMinutes',
        sql.Int,
        otpExpiryMinutes
      )
      .query(`
        INSERT INTO dbo.LoginOtpCodes (
          UserId,
          Purpose,
          CodeHash,
          ExpiresAtUtc
        )
        VALUES (
          @UserId,
          @Purpose,
          @CodeHash,
          DATEADD(
            MINUTE,
            @ExpiryMinutes,
            SYSUTCDATETIME()
          )
        )
      `);

    await transaction.commit();

    otpToDeliver = otp;
    deliveryEmail = user.Email;
  } catch (error) {
    try {
      await transaction.rollback();
    } catch {}

    throw error;
  }

  await deliverOtp({
    email: deliveryEmail,
    otp: otpToDeliver,
    purpose
  });

  return {
    issued: true,
    purpose
  };
}

function hashSessionToken(token) {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
}

async function verifyOtp({ email: rawEmail, otp }) {
  const normalizedEmail = normalizeEmail(rawEmail);
  const normalizedOtp = String(otp || '').trim();

  if (!isValidEmail(normalizedEmail)) {
    throw new AuthInputError('Enter a valid email address');
  }

  if (!/^\d{6}$/.test(normalizedOtp)) {
    throw new AuthInputError('Enter the 6-digit verification code');
  }

  const {
    otpMaxAttempts,
    sessionExpiryDays
  } = getAuthConfig();

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    const userResult = await new sql.Request(transaction)
      .input(
        'NormalizedEmail',
        sql.NVarChar(320),
        normalizedEmail
      )
      .query(`
        SELECT
          UserId,
          Email,
          EmailVerified,
          AccountStatus
        FROM dbo.Users WITH (UPDLOCK, HOLDLOCK)
        WHERE NormalizedEmail = @NormalizedEmail
      `);

    const user = userResult.recordset[0];

    if (
      !user ||
      user.AccountStatus === 'SUSPENDED' ||
      user.AccountStatus === 'CLOSED'
    ) {
      await transaction.commit();

      return {
        verified: false,
        reason: 'invalid_code'
      };
    }

    const otpResult = await new sql.Request(transaction)
      .input(
        'UserId',
        sql.UniqueIdentifier,
        user.UserId
      )
      .query(`
        SELECT TOP (1)
          LoginOtpCodeId,
          Purpose,
          CodeHash,
          AttemptCount,
          ExpiresAtUtc
        FROM dbo.LoginOtpCodes WITH (UPDLOCK, HOLDLOCK)
        WHERE UserId = @UserId
          AND Purpose IN (N'LOGIN', N'REGISTER')
          AND UsedAtUtc IS NULL
        ORDER BY CreatedAtUtc DESC
      `);

    const otpRecord = otpResult.recordset[0];

    if (
      !otpRecord ||
      otpRecord.AttemptCount >= otpMaxAttempts ||
      new Date(otpRecord.ExpiresAtUtc).getTime() <= Date.now()
    ) {
      await transaction.commit();

      return {
        verified: false,
        reason: 'invalid_code'
      };
    }

    const submittedHash = hashOtp({
      userId: user.UserId,
      purpose: otpRecord.Purpose,
      otp: normalizedOtp
    });

    const storedHashBuffer = Buffer.from(
      otpRecord.CodeHash,
      'hex'
    );

    const submittedHashBuffer = Buffer.from(
      submittedHash,
      'hex'
    );

    const hashMatches =
      storedHashBuffer.length === submittedHashBuffer.length &&
      crypto.timingSafeEqual(
        storedHashBuffer,
        submittedHashBuffer
      );

    if (!hashMatches) {
      await new sql.Request(transaction)
        .input(
          'LoginOtpCodeId',
          sql.UniqueIdentifier,
          otpRecord.LoginOtpCodeId
        )
        .input(
          'OtpMaxAttempts',
          sql.Int,
          otpMaxAttempts
        )
        .query(`
          UPDATE dbo.LoginOtpCodes
          SET
            AttemptCount =
              CASE
                WHEN AttemptCount < @OtpMaxAttempts
                THEN AttemptCount + 1
                ELSE AttemptCount
              END,
            UsedAtUtc =
              CASE
                WHEN AttemptCount + 1 >= @OtpMaxAttempts
                THEN SYSUTCDATETIME()
                ELSE UsedAtUtc
              END
          WHERE LoginOtpCodeId = @LoginOtpCodeId
        `);

      await transaction.commit();

      return {
        verified: false,
        reason: 'invalid_code'
      };
    }

    await new sql.Request(transaction)
      .input(
        'LoginOtpCodeId',
        sql.UniqueIdentifier,
        otpRecord.LoginOtpCodeId
      )
      .query(`
        UPDATE dbo.LoginOtpCodes
        SET UsedAtUtc = SYSUTCDATETIME()
        WHERE LoginOtpCodeId = @LoginOtpCodeId
      `);

    if (otpRecord.Purpose === 'REGISTER') {
      await new sql.Request(transaction)
        .input(
          'UserId',
          sql.UniqueIdentifier,
          user.UserId
        )
        .query(`
          UPDATE dbo.Users
          SET
            EmailVerified = 1,
            EmailVerifiedAtUtc =
              COALESCE(
                EmailVerifiedAtUtc,
                SYSUTCDATETIME()
              ),
            AccountStatus = N'ACTIVE',
            LastLoginAtUtc = SYSUTCDATETIME(),
            UpdatedAtUtc = SYSUTCDATETIME()
          WHERE UserId = @UserId
        `);
    } else {
      await new sql.Request(transaction)
        .input(
          'UserId',
          sql.UniqueIdentifier,
          user.UserId
        )
        .query(`
          UPDATE dbo.Users
          SET
            LastLoginAtUtc = SYSUTCDATETIME(),
            UpdatedAtUtc = SYSUTCDATETIME()
          WHERE UserId = @UserId
        `);
    }

    const sessionToken =
      crypto.randomBytes(48).toString('base64url');

    const sessionTokenHash =
      hashSessionToken(sessionToken);

    await new sql.Request(transaction)
      .input(
        'UserId',
        sql.UniqueIdentifier,
        user.UserId
      )
      .input(
        'SessionTokenHash',
        sql.NVarChar(255),
        sessionTokenHash
      )
      .input(
        'SessionExpiryDays',
        sql.Int,
        sessionExpiryDays
      )
      .query(`
        INSERT INTO dbo.UserSessions (
          UserId,
          SessionTokenHash,
          ExpiresAtUtc
        )
        VALUES (
          @UserId,
          @SessionTokenHash,
          DATEADD(
            DAY,
            @SessionExpiryDays,
            SYSUTCDATETIME()
          )
        )
      `);

    await transaction.commit();

    return {
      verified: true,
      userId: user.UserId,
      email: user.Email,
      sessionToken
    };
  } catch (error) {
    try {
      await transaction.rollback();
    } catch {}

    throw error;
  }
}

async function getAuthenticatedUser(sessionToken) {
  const token = String(sessionToken || '').trim();

  if (!token) {
    return null;
  }

  const sessionTokenHash =
    hashSessionToken(token);

  const pool = await getPool();

  const result = await pool.request()
    .input(
      'SessionTokenHash',
      sql.NVarChar(255),
      sessionTokenHash
    )
    .query(`
      SELECT TOP (1)
        s.SessionId,
        s.UserId,
        s.ExpiresAtUtc,
        u.Email,
        u.FirstName,
        u.LastName,
        u.EmailVerified,
        u.AccountStatus
      FROM dbo.UserSessions s
      INNER JOIN dbo.Users u
        ON u.UserId = s.UserId
      WHERE s.SessionTokenHash = @SessionTokenHash
        AND s.RevokedAtUtc IS NULL
        AND s.ExpiresAtUtc > SYSUTCDATETIME()
        AND u.AccountStatus = N'ACTIVE'
    `);

  const row = result.recordset[0];

  if (!row) {
    return null;
  }

  await pool.request()
    .input(
      'SessionId',
      sql.UniqueIdentifier,
      row.SessionId
    )
    .query(`
      UPDATE dbo.UserSessions
      SET LastUsedAtUtc = SYSUTCDATETIME()
      WHERE SessionId = @SessionId
    `);

  return {
    userId: row.UserId,
    email: row.Email,
    firstName: row.FirstName,
    lastName: row.LastName,
    emailVerified: Boolean(row.EmailVerified),
    accountStatus: row.AccountStatus
  };
}

async function revokeSession(sessionToken) {
  const token = String(sessionToken || '').trim();

  if (!token) {
    return false;
  }

  const sessionTokenHash =
    hashSessionToken(token);

  const pool = await getPool();

  const result = await pool.request()
    .input(
      'SessionTokenHash',
      sql.NVarChar(255),
      sessionTokenHash
    )
    .query(`
      UPDATE dbo.UserSessions
      SET RevokedAtUtc =
        COALESCE(
          RevokedAtUtc,
          SYSUTCDATETIME()
        )
      WHERE SessionTokenHash = @SessionTokenHash
        AND RevokedAtUtc IS NULL;

      SELECT @@ROWCOUNT AS RevokedCount;
    `);

  return (
    result.recordset[0] &&
    result.recordset[0].RevokedCount > 0
  );
}

module.exports = {
  AuthInputError,
  normalizeEmail,
  requestOtp,
  verifyOtp,
  getAuthenticatedUser,
  revokeSession,
};
