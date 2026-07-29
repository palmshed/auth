# Sequence Diagrams

## Sign In

```
Client                    Auth                          Storage
  |                         |                              |
  |-- POST /signin -------->|                              |
  |   {username, password}  |                              |
  |                         |-- getUserWithPassword() ---->|
  |                         |<--- {user, hash, salt} ------|
  |                         |                              |
  |                         |-- verify password (Argon2id) |
  |                         |                              |
  |                         |-- getActiveSigningKey() ---->|
  |                         |<--- signing key -------------|
  |                         |                              |
  |                         |-- generateSessionTokens()    |
  |                         |-- signToken() (HMAC)         |
  |                         |                              |
  |                         |-- createSession() ---------->|
  |                         |<--- session -----------------|
  |                         |                              |
  |                         |-- enforceMaxSessions() ----->|
  |                         |                              |
  |<-- {ok, token, ---------|                              |
  |   refreshToken, user}   |                              |
```

## Session Validation

```
Client                    Auth                          Storage
  |                         |                              |
  |-- GET /session -------->|                              |
  |   Authorization: Bearer |                              |
  |                         |-- parseSignedToken()         |
  |                         |-- getKeyById() ------------>|
  |                         |<--- signing key -------------|
  |                         |-- verifySignedToken() (HMAC) |
  |                         |                              |
  |                         |-- getSessionByToken() ------>|
  |                         |<--- session -----------------|
  |                         |                              |
  |                         |-- check expiry (idle/abs)    |
  |                         |-- getUserById() ----------->|
  |                         |<--- user --------------------|
  |                         |                              |
  |<-- {ok, user, session}  |                              |
```

## Token Refresh

```
Client                    Auth                          Storage
  |                         |                              |
  |-- POST /refresh ------->|                              |
  |   {refreshToken}        |                              |
  |                         |-- getSessionByRefresh() ---->|
  |                         |<--- session -----------------|
  |                         |                              |
  |                         |-- check absoluteExpiresAt    |
  |                         |                              |
  |                         |-- generateSessionTokens()    |
  |                         |-- signToken() (new key)      |
  |                         |                              |
  |                         |-- deleteSession(old) ------->|
  |                         |-- createSession(new) ------->|
  |                         |                              |
  |<-- {ok, newToken, ------|                              |
  |   newRefreshToken}      |                              |
```

## Password Reset

```
Client                    Auth                          Storage          Email
  |                         |                              |               |
  |-- POST /forgot -------->|                              |               |
  |   {username, captcha}   |                              |               |
  |                         |-- getUserByUsername() ------>|               |
  |                         |<--- user --------------------|               |
  |                         |                              |               |
  |                         |-- createPasswordReset() ---->|               |
  |                         |                              |-- email ----->|
  |<-- {ok} ----------------|                              |               |
  |                         |                              |               |
  |-- POST /reset --------->|                              |               |
  |   {token, password}     |                              |               |
  |                         |-- getPasswordResetByToken() >|               |
  |                         |<--- reset -------------------|               |
  |                         |                              |               |
  |                         |-- hash password (Argon2id)   |               |
  |                         |-- updateUserPassword() ----->|               |
  |                         |-- markPasswordResetUsed() -->|               |
  |                         |-- revokeUserSessions() ----->|               |
  |                         |                              |               |
  |<-- {ok} ----------------|                              |               |
```

## Sign Out

```
Client                    Auth                          Storage
  |                         |                              |
  |-- POST /signout ------->|                              |
  |   Authorization: Bearer |                              |
  |                         |-- parseSignedToken()         |
  |                         |-- deleteSession(plain) ---->|
  |                         |                              |
  |<-- {ok} ----------------|                              |
```

## Concurrent Session Limit

```
Client1                   Auth                          Storage
  |                         |                              |
  |-- POST /signin -------->|                              |
  |                         |-- createSession() ---------->|
  |                         |-- enforceMaxSessions() ----->|
  |                         |   - listUserSessions()       |
  |                         |   - revokeSession(oldest)    |
  |                         |                              |
  |<-- {ok} ----------------|                              |
```
