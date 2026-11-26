import { AuthForm } from "../auth-form";
export const metadata = { title: "Start your free trial" };

export default function SignupPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Start your 14-day free trial</h1>
      <p className="mb-8 mt-1.5 text-sm text-muted">No card required. Set up in about 10 minutes.</p>
      <AuthForm mode="signup" />
    </>
  );
}
