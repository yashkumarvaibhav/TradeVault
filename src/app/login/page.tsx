import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// The dedicated sign-in screen is retired: auth now happens in the landing-page modal.
// This route is kept only as a canonical, link-friendly redirect that opens the modal.
export default function LoginPage() {
  redirect("/?auth=signin");
}
