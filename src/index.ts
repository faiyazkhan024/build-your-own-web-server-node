import { startHTTPServer } from "./http-server";

async function main(): Promise<void> {
  await startHTTPServer({ host: "127.0.0.1", port: 1234 });
}

main().catch((err: Error) => {
  console.error("server error:", err);
});
