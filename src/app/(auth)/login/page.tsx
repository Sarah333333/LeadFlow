import { AuthForm } from "../auth-form";
export const metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mb-8 mt-1.5 text-sm text-muted">Log in to see your leads.</p>
      <AuthForm mode="login" next={next} />
    </>
  );
}
