// Better-Auth's error codes, said the way DESIGN.md asks: what happened and what to do, in one sentence.
const MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "That email and password don't match. Check them and try again.",
  USER_ALREADY_EXISTS: "There is already an account for that email. Sign in instead.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "There is already an account for that email. Sign in instead.",
  PASSWORD_TOO_SHORT: "The password needs at least 8 characters.",
  PASSWORD_TOO_LONG: "That password is too long. Use 128 characters or fewer.",
  INVALID_EMAIL: "That doesn't look like an email address. Check it and try again.",
  // sign-up's answer to any field it rejects (a malformed email among them); it doesn't say which
  VALIDATION_ERROR: "Something you typed wasn't accepted. Check your name, email and password and try again.",
};

// Loose on purpose: catches the obvious slips ("margery-at-lynn") and leaves the rest to the server.
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const FALLBACK_MESSAGE = "Something went wrong on our side. Try again in a moment.";

export const MIN_PASSWORD = 8;

// Checked in the browser before sending, so the form explains a mistake in our words rather than the browser's.
export function checkAuthForm(form: { name?: string; email: string; password: string }, mode: "signup" | "signin"): string | null {
  if (mode === "signup" && !form.name?.trim()) return "Enter your name.";
  if (!form.email.trim()) return "Enter your email address.";
  if (!EMAIL_SHAPE.test(form.email.trim())) return MESSAGES.INVALID_EMAIL;
  if (!form.password) return "Enter your password.";
  if (mode === "signup" && form.password.length < MIN_PASSWORD) return MESSAGES.PASSWORD_TOO_SHORT;
  return null;
}

export function authErrorMessage(code: string | undefined | null): string {
  return (code && MESSAGES[code]) || FALLBACK_MESSAGE;
}
