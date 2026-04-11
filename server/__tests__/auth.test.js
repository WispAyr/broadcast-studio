/**
 * Tests for auth middleware — JWT verification, role checking, and hardcoded secret removal.
 */

// Set env before requiring auth module
process.env.JWT_SECRET = 'test-secret-for-jest';

const jwt = require('jsonwebtoken');
const { authenticate, optionalAuthenticate, requireRole, JWT_SECRET } = require('../src/middleware/auth');

function mockReq(headers = {}) {
  return { headers };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('JWT_SECRET', () => {
  test('uses environment variable, not a hardcoded fallback', () => {
    expect(JWT_SECRET).toBe('test-secret-for-jest');
    expect(JWT_SECRET).not.toBe('broadcast-studio-jwt-2026');
  });
});

describe('authenticate middleware', () => {
  test('rejects request with no Authorization header', () => {
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects request with invalid token', () => {
    const req = mockReq({ authorization: 'Bearer invalid-token' });
    const res = mockRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('accepts request with valid token and sets req.user', () => {
    const payload = { id: '123', username: 'admin', role: 'super_admin' };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
    const req = mockReq({ authorization: `Bearer ${token}` });
    const res = mockRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user.id).toBe('123');
    expect(req.user.username).toBe('admin');
    expect(req.user.role).toBe('super_admin');
  });

  test('rejects expired token', () => {
    const token = jwt.sign({ id: '123' }, JWT_SECRET, { expiresIn: '-1s' });
    const req = mockReq({ authorization: `Bearer ${token}` });
    const res = mockRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects token signed with wrong secret', () => {
    const token = jwt.sign({ id: '123' }, 'wrong-secret');
    const req = mockReq({ authorization: `Bearer ${token}` });
    const res = mockRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('optionalAuthenticate middleware', () => {
  test('passes through with no auth header, setting req.user to null', () => {
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    optionalAuthenticate(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeNull();
  });

  test('sets user from valid token', () => {
    const token = jwt.sign({ id: '123', role: 'viewer' }, JWT_SECRET);
    const req = mockReq({ authorization: `Bearer ${token}` });
    const res = mockRes();
    const next = jest.fn();

    optionalAuthenticate(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user.id).toBe('123');
  });

  test('sets user to null on invalid token and continues', () => {
    const req = mockReq({ authorization: 'Bearer bad-token' });
    const res = mockRes();
    const next = jest.fn();

    optionalAuthenticate(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeNull();
  });
});

describe('requireRole middleware', () => {
  test('rejects unauthenticated request', () => {
    const middleware = requireRole(['admin']);
    const req = { user: null };
    const res = mockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects user with wrong role', () => {
    const middleware = requireRole(['super_admin']);
    const req = { user: { role: 'viewer' } };
    const res = mockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('accepts user with correct role', () => {
    const middleware = requireRole(['admin', 'super_admin']);
    const req = { user: { role: 'admin' } };
    const res = mockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
