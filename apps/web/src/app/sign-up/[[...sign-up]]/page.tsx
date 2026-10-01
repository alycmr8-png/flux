import { SignUp } from "@clerk/nextjs";
import { AuthShell } from "@/components/AuthShell";

export const metadata = { title: "Create your account" };

export default function SignUpPage() {
  return (
    <AuthShell>
      <SignUp />
    </AuthShell>
  );
}
