import { fileURLToPath } from "node:url";

// node --env-file=.env scripts/rounds-roles.mjs [cursor] > rounds-jobs.json

const FIREBASE_KEY = "AIzaSyA2EBoHnei4X1rXbXAL8Etcuttz_h9n7Nk";
const TEAM_ID = "shared:8TN2SvSQdqdlYPW49zRSV8JKAkN2";

export async function getRoles(cursor = 0, fetcher = fetch) {
  const { ROUNDS_EMAIL: email, ROUNDS_PASSWORD: password } = process.env;
  if (!email || !password)
    throw new Error("Set ROUNDS_EMAIL and ROUNDS_PASSWORD");

  const login = await fetcher(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_KEY}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        returnSecureToken: true,
        email,
        password,
        clientType: "CLIENT_TYPE_WEB",
      }),
    },
  );
  if (!login.ok) throw new Error(`Rounds login failed (${login.status})`);
  const { idToken } = await login.json();

  const roles = await fetcher(
    `https://s1.rounds.so/api/placements/recruiter/roles-catalog?cursor=${cursor}&limit=25`,
    {
      headers: {
        authorization: `Bearer ${idToken}`,
        "x-recruiter-team-id": TEAM_ID,
      },
    },
  );
  if (!roles.ok)
    throw new Error(`Rounds roles request failed (${roles.status})`);
  return roles.json();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(
    JSON.stringify(await getRoles(Number(process.argv[2] ?? 0)), null, 2),
  );
}
