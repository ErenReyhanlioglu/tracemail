// Login: a single link into the API's Google Sign-In (ADR-0015). The page
// holds no authentication logic; the API sets the session.
import { strings } from "@/lib/strings";

import styles from "./page.module.css";

const GOOGLE_LOGIN_URL = "/api/v1/auth/google/login";

export default function LoginPage() {
  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <span className={styles.brandName}>{strings.appName}</span>
        <h1 className={styles.title}>{strings.login.title}</h1>
        <p className={styles.body}>{strings.login.body}</p>
        <a className={styles.button} href={GOOGLE_LOGIN_URL}>
          {strings.login.google}
        </a>
      </section>
    </main>
  );
}
