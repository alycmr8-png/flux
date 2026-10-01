import { SignIn } from "@clerk/nextjs";
import { AuthShell } from "@/components/AuthShell";

export const metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <AuthShell>
      <SignIn />
    </AuthShell>
  );
}
