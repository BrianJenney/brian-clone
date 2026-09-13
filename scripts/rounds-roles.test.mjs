import assert from "node:assert";
import { getRoles } from "./rounds-roles.mjs";

process.env.ROUNDS_EMAIL = "test@example.com";
process.env.ROUNDS_PASSWORD = "test-password";

const requests = [];
const result = await getRoles(25, async (url, init) => {
  requests.push({ url, init });
  return requests.length === 1
    ? Response.json({ idToken: "test-token" })
    : Response.json({
        jobs: [{ location: "Remote", description: "Build things" }],
      });
});

assert.equal(requests[1].url.endsWith("cursor=25&limit=25"), true);
assert.equal(requests[1].init.headers.authorization, "Bearer test-token");
assert.deepEqual(result.jobs[0], {
  location: "Remote",
  description: "Build things",
});

console.log("Rounds roles self-check: all passed");
