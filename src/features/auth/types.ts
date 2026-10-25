export type LoginState = { error?: string; email?: string };
export type RegisterState = { error?: string; values?: { firstName: string; lastName: string; email: string } };
export type ForgotPasswordState = { error?: string; sent?: boolean };
export type ResetPasswordState = { error?: string };
