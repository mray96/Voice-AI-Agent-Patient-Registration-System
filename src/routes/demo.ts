import type { FastifyInstance } from "fastify";

const DEFAULT_ASSISTANT_ID = "6d1dd7d7-6b4e-4314-94eb-e1099762dd2d";

export interface DemoRouteOptions {
  vapiPublicKey?: string;
  vapiAssistantId?: string;
}

function scriptValue(value: string): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function renderDemoPage(options: DemoRouteOptions): string {
  const publicKey = options.vapiPublicKey ?? "";
  const assistantId = options.vapiAssistantId ?? DEFAULT_ASSISTANT_ID;
  const configured = publicKey.length > 0;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Patient Registration Voice Demo</title>
    <style>
      :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px;
        background: radial-gradient(circle at top, #143b45, #081217 55%, #050708); color: #e6f4f2; }
      main { width: min(680px, 100%); padding: 42px; border: 1px solid #28545b; border-radius: 22px;
        background: rgba(7, 19, 23, .92); box-shadow: 0 24px 80px rgba(0,0,0,.35); }
      .eyebrow { color: #63d6c8; font-size: 12px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
      h1 { margin: 12px 0; font-size: clamp(30px, 6vw, 48px); line-height: 1.05; }
      p { color: #b9cfcc; line-height: 1.65; }
      ol { color: #cfe2df; line-height: 1.9; padding-left: 24px; }
      .status { margin-top: 28px; padding: 14px 16px; border-radius: 12px; background: #0d282d; color: #a5e8e0; }
      .warning { background: #3a2416; color: #ffd3a8; }
      code { color: #8de9dd; }
      footer { margin-top: 30px; color: #78918e; font-size: 13px; }
    </style>
  </head>
  <body>
    <main>
      <div class="eyebrow">Voice AI assessment</div>
      <h1>Patient registration demo</h1>
      <p>This assistant registers fictional test patients. It is not a medical service.</p>
      <ol>
        <li>Allow microphone access when your browser asks.</li>
        <li>Use the Vapi button in the lower-right corner to start the call.</li>
        <li>Provide fictional details and confirm the read-back before saving.</li>
      </ol>
      <div class="status${configured ? "" : " warning"}">
        ${configured ? "Voice demo ready. Click the Vapi button to begin." : "The demo is not configured yet. Add VAPI_PUBLIC_KEY to the deployment environment."}
      </div>
      <footer>For API testing, open <code>/docs</code> on this deployment.</footer>
    </main>
    ${configured ? `<script>
      const assistant = ${scriptValue(assistantId)};
      const apiKey = ${scriptValue(publicKey)};
      const buttonConfig = {
        position: "bottom-right",
        offset: "24px",
        width: "56px",
        height: "56px",
        idle: { color: "#18b7a6", type: "round", title: "Start voice call", subtitle: "Patient registration" },
        loading: { color: "#0f766e", type: "round", title: "Connecting...", subtitle: "Please wait" },
        active: { color: "#ef8354", type: "round", title: "Call in progress", subtitle: "Click to end" }
      };
      (function (d, t) {
        const g = d.createElement(t);
        const s = d.getElementsByTagName(t)[0];
        g.src = "https://cdn.jsdelivr.net/gh/VapiAI/html-script-tag@latest/dist/assets/index.js";
        g.defer = true;
        g.async = true;
        s.parentNode.insertBefore(g, s);
        g.onload = function () {
          window.vapiSDK.run({ apiKey, assistant, config: buttonConfig });
        };
      })(document, "script");
    </script>` : ""}
  </body>
</html>`;
}

export async function registerDemoRoutes(
  app: FastifyInstance,
  options: DemoRouteOptions,
) {
  app.get("/demo", { schema: { hide: true } }, async (_request, reply) =>
    reply.type("text/html; charset=utf-8").send(renderDemoPage(options)),
  );
}
