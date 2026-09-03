const assert = require('assert');

const { createApp } = require('../src/app');
const {
  getPool,
  closePool,
  sql
} = require('../src/db/pool');

async function main() {
  let server;
  let capturedOtp = null;
  let testUserId = null;

  const originalLog = console.log;

  const testEmail =
    `applysmart-auth-regression-${Date.now()}@example.com`;

  console.log = (...args) => {
    const message = args
      .map((value) => String(value))
      .join(' ');

    const otpMatch = message.match(
      /\[DEV OTP\].*code=(\d{6})/
    );

    if (otpMatch) {
      capturedOtp = otpMatch[1];
      return;
    }

    originalLog(...args);
  };

  try {
    const app = createApp();

    await new Promise((resolve) => {
      server = app.listen(
        0,
        '127.0.0.1',
        resolve
      );
    });

    const { port } = server.address();
    const baseUrl =
      `http://127.0.0.1:${port}`;

    const requestResponse = await fetch(
      `${baseUrl}/api/auth/otp/request`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: testEmail
        })
      }
    );

    assert.strictEqual(
      requestResponse.status,
      200,
      'OTP request should return 200'
    );

    assert.match(
      capturedOtp || '',
      /^\d{6}$/,
      'A six-digit OTP should be delivered'
    );

    originalLog(
      'PASS: authentication regression requested OTP'
    );

    const pool = await getPool();

    const otpStateResult = await pool.request()
      .input(
        'NormalizedEmail',
        sql.NVarChar(320),
        testEmail.toLowerCase()
      )
      .query(`
        SELECT TOP (1)
          u.UserId,
          u.AccountStatus,
          u.EmailVerified,
          o.CodeHash,
          o.UsedAtUtc
        FROM dbo.Users u
        INNER JOIN dbo.LoginOtpCodes o
          ON o.UserId = u.UserId
        WHERE
          u.NormalizedEmail = @NormalizedEmail
        ORDER BY o.CreatedAtUtc DESC
      `);

    const initialState =
      otpStateResult.recordset[0];

    assert.ok(
      initialState,
      'OTP database record should exist'
    );

    testUserId = initialState.UserId;

    assert.strictEqual(
      initialState.CodeHash.length,
      64,
      'OTP should be stored as a SHA-256 HMAC hash'
    );

    assert.notStrictEqual(
      initialState.CodeHash,
      capturedOtp,
      'Plaintext OTP must not be stored'
    );

    originalLog(
      'PASS: database stores OTP hash, not plaintext'
    );

    const verifyResponse = await fetch(
      `${baseUrl}/api/auth/otp/verify`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: testEmail,
          otp: capturedOtp
        })
      }
    );

    assert.strictEqual(
      verifyResponse.status,
      200,
      'OTP verification should return 200'
    );

    const setCookie =
      verifyResponse.headers.get('set-cookie');

    assert.ok(
      setCookie,
      'Verification should set a session cookie'
    );

    assert.match(
      setCookie,
      /HttpOnly/i,
      'Session cookie should be HttpOnly'
    );

    assert.match(
      setCookie,
      /SameSite=Lax/i,
      'Session cookie should use SameSite=Lax'
    );

    const cookiePair =
      setCookie.split(';')[0];

    const verifiedStateResult =
      await pool.request()
        .input(
          'UserId',
          sql.UniqueIdentifier,
          testUserId
        )
        .query(`
          SELECT
            EmailVerified,
            AccountStatus
          FROM dbo.Users
          WHERE UserId = @UserId;

          SELECT TOP (1)
            SessionTokenHash,
            RevokedAtUtc
          FROM dbo.UserSessions
          WHERE UserId = @UserId
          ORDER BY CreatedAtUtc DESC;
        `);

    const verifiedUser =
      verifiedStateResult.recordsets[0][0];

    const session =
      verifiedStateResult.recordsets[1][0];

    assert.strictEqual(
      Boolean(verifiedUser.EmailVerified),
      true,
      'User email should be verified'
    );

    assert.strictEqual(
      verifiedUser.AccountStatus,
      'ACTIVE',
      'Registered user should become ACTIVE'
    );

    assert.ok(
      session &&
      /^[a-f0-9]{64}$/i.test(
        session.SessionTokenHash
      ),
      'Database should contain only session-token hash'
    );

    originalLog(
      'PASS: OTP verification activated user and created hashed session'
    );

    const meResponse = await fetch(
      `${baseUrl}/api/auth/me`,
      {
        headers: {
          Cookie: cookiePair
        }
      }
    );

    assert.strictEqual(
      meResponse.status,
      200,
      'Valid session should authenticate'
    );

    const meBody =
      await meResponse.json();

    assert.strictEqual(
      meBody.user.email,
      testEmail,
      'Authenticated user should match test user'
    );

    originalLog(
      'PASS: /api/auth/me accepts valid session'
    );

    const logoutResponse = await fetch(
      `${baseUrl}/api/auth/logout`,
      {
        method: 'POST',
        headers: {
          Cookie: cookiePair
        }
      }
    );

    assert.strictEqual(
      logoutResponse.status,
      200,
      'Logout should return 200'
    );

    const revokedResult =
      await pool.request()
        .input(
          'UserId',
          sql.UniqueIdentifier,
          testUserId
        )
        .query(`
          SELECT TOP (1)
            RevokedAtUtc
          FROM dbo.UserSessions
          WHERE UserId = @UserId
          ORDER BY CreatedAtUtc DESC
        `);

    assert.ok(
      revokedResult.recordset[0].RevokedAtUtc,
      'Logout should revoke session in database'
    );

    const afterLogoutResponse = await fetch(
      `${baseUrl}/api/auth/me`,
      {
        headers: {
          Cookie: cookiePair
        }
      }
    );

    assert.strictEqual(
      afterLogoutResponse.status,
      401,
      'Revoked session must not authenticate'
    );

    originalLog(
      'PASS: logout revokes session and /api/auth/me rejects it'
    );

    originalLog(
      'Authentication API regression: PASS'
    );
  } finally {
    console.log = originalLog;

    try {
      if (testUserId) {
        const pool = await getPool();

        await pool.request()
          .input(
            'UserId',
            sql.UniqueIdentifier,
            testUserId
          )
          .query(`
            DELETE FROM dbo.UserSessions
            WHERE UserId = @UserId;

            DELETE FROM dbo.LoginOtpCodes
            WHERE UserId = @UserId;

            DELETE FROM dbo.Users
            WHERE UserId = @UserId;
          `);
      }
    } catch (cleanupError) {
      originalLog(
        'Authentication test cleanup failed:',
        cleanupError.message
      );
    }

    try {
      await closePool();
    } catch {}

    if (server) {
      await new Promise((resolve) => {
        server.close(resolve);
      });
    }
  }
}

main().catch((error) => {
  console.error(
    'Authentication API regression: FAIL'
  );
  console.error(error);
  process.exitCode = 1;
});
