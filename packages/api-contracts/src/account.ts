export interface LoginRequest {
  readonly email: string;
  readonly password: string;
}

export interface AccountProfile {
  readonly publicId: string;
  readonly fullName: string;
  readonly emailVerified: true;
}

export interface SessionAccount {
  readonly account: AccountProfile;
}

export interface CsrfResponse {
  readonly csrfToken: string;
}

export interface PasswordResetRequest {
  readonly email: string;
}

export interface PasswordResetConfirmation {
  readonly token: string;
  readonly password: string;
}

export interface PasswordResetCompleted {
  readonly status: 'reset';
}
