import { z } from 'zod';
import { tokenPattern } from '@sportify/verification-email';
import type {
  ConfirmEmailRequest,
  RegisterAccountRequest,
  ResendVerificationRequest,
} from '@sportify/api-contracts';
import { passwordIsValid } from './password.js';

const email = z
  .string()
  .max(320)
  .trim()
  .pipe(
    z
      .email()
      .max(254)
      .regex(/^[!-~]+$/),
  );
const mobile = z
  .string()
  .regex(/^\+[1-9][0-9]{1,14}$/)
  .refine((value) => !/\s/.test(value));
const name = (limit: number) =>
  z
    .string()
    .max(limit * 2)
    .trim()
    .min(1)
    .refine((value) => [...value].length <= limit && !/[\p{Cc}\p{Surrogate}]/u.test(value));

export class RegisterDto implements RegisterAccountRequest {
  static readonly schema = z.strictObject({ email, fullName: name(160), mobile });
  declare email: string;
  declare fullName: string;
  declare mobile: string;
}

export class ResendDto implements ResendVerificationRequest {
  static readonly schema = z.strictObject({ email });
  declare email: string;
}

export class ConfirmDto implements ConfirmEmailRequest {
  static readonly schema = z.strictObject({
    token: z.string().length(43).regex(tokenPattern),
    password: z.string().refine(passwordIsValid),
    fullName: name(160),
    mobile,
    tenantName: name(200),
  });
  declare token: string;
  declare password: string;
  declare fullName: string;
  declare mobile: string;
  declare tenantName: string;
}
