// Auth server utilities — simplified (no login required)
// Since the app has no login page, admin actions are accessible directly

export async function requireAdmin() {
  // No login page — admin is directly accessible
  // Return a placeholder user object for compatibility
  return {
    id: 'admin',
    email: 'admin@youvo.ai',
  };
}

export async function getSession() {
  // No session management needed
  return null;
}
