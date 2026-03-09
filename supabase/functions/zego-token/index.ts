import { Buffer } from "node:buffer";
import { createCipheriv } from "node:crypto";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const APP_ID = 1483807521;

const getAlgorithm = (key: string) => {
  const byteLength = Buffer.from(key).length;
  if (byteLength === 16) return "aes-128-cbc";
  if (byteLength === 24) return "aes-192-cbc";
  if (byteLength === 32) return "aes-256-cbc";
  throw new Error("Invalid ZEGO secret length");
};

const makeRandomIv = () => {
  const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
};

const randomSignedInt32 = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return new DataView(bytes.buffer).getInt32(0, false);
};

const generateToken04 = (appId: number, userId: string, secret: string, effectiveTimeInSeconds: number, payload = "") => {
  const createTime = Math.floor(Date.now() / 1000);
  const tokenInfo = {
    app_id: appId,
    user_id: userId,
    nonce: randomSignedInt32(),
    ctime: createTime,
    expire: createTime + effectiveTimeInSeconds,
    payload,
  };

  const iv = makeRandomIv();
  const cipher = createCipheriv(getAlgorithm(secret), secret, iv);
  cipher.setAutoPadding(true);

  const encrypted = Buffer.concat([cipher.update(JSON.stringify(tokenInfo)), cipher.final()]);

  const expireBytes = new Uint8Array(8);
  new DataView(expireBytes.buffer).setBigInt64(0, BigInt(tokenInfo.expire), false);

  const ivLengthBytes = new Uint8Array(2);
  new DataView(ivLengthBytes.buffer).setUint16(0, iv.length, false);

  const encryptedLengthBytes = new Uint8Array(2);
  new DataView(encryptedLengthBytes.buffer).setUint16(0, encrypted.byteLength, false);

  const packed = Buffer.concat([
    Buffer.from(expireBytes),
    Buffer.from(ivLengthBytes),
    Buffer.from(iv),
    Buffer.from(encryptedLengthBytes),
    encrypted,
  ]);

  return `04${packed.toString("base64")}`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const serverSecret = Deno.env.get("ZEGO_SERVER_SECRET");

    if (!supabaseUrl || !supabaseAnonKey || !serverSecret) {
      return new Response(JSON.stringify({ error: "Server configuration missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const callRoomID = typeof body?.callRoomID === "string" ? body.callRoomID.trim() : "";
    const userID = typeof body?.userID === "string" ? body.userID.trim() : "";
    const userName = typeof body?.userName === "string" ? body.userName.trim() : "";

    if (!callRoomID || !userID || !userName) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (user.id !== userID) {
      return new Response(JSON.stringify({ error: "User mismatch" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = generateToken04(APP_ID, userID, serverSecret, 60 * 60 * 2);

    return new Response(JSON.stringify({ token, appID: APP_ID }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
