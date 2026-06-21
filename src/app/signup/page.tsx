import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// The dedicated sign-up screen is retired: auth now happens in the landing-page modal.
// This route is kept only as a canonical, link-friendly redirect that opens the modal.
export default function SignupPage() {
  redirect("/?auth=signup");
}
