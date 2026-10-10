// The site root opens the application list (the only section in step 1.10).
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/applications");
}
