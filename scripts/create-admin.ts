import { db } from "../src/lib/db";
import { auth } from "../src/lib/auth";

async function createAdmin() {
  const user = await auth.api.signUpEmail({
    body: {
      email: "progdieter@dascheberg.de",
      password: "scsadmin",
      name: "Dieter Dascheberg",
    },
  });

  // Rolle auf admin setzen
  await db.execute(
    `UPDATE "user" SET role = 'admin' WHERE email = 'progdieter@dascheberg.de'`
  );

  console.log("Admin angelegt:", user);
}

createAdmin().catch(console.error).finally(() => process.exit(0));
