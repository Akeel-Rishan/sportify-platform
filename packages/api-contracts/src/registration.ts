export interface RegisterAccountRequest {
  readonly email: string;
  readonly fullName: string;
  readonly mobile: string;
}

export interface ConfirmEmailRequest {
  readonly token: string;
  readonly password: string;
  readonly fullName: string;
  readonly mobile: string;
  readonly tenantName: string;
}

export interface ResendVerificationRequest {
  readonly email: string;
}

export interface RegistrationAccepted {
  readonly status: 'accepted';
}

export interface RegistrationVerified {
  readonly status: 'verified';
}
