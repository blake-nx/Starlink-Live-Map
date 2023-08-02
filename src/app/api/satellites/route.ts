const N2YO_API_KEY = process.env.NEXT_N2YO_API_KEY;
import type { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");
    const res = await fetch(
      `https://api.n2yo.com/rest/v1/satellite/above/${lat}/${lng}/0/70/52/&apiKey=${N2YO_API_KEY}`
    );

    // Check if the request was successful
    if (!res.ok) {
      console.error("API request not successful");
      return new Response(null, { status: res.status });
    }

    let data;
    try {
      data = await res.json();
    } catch (err) {
      console.error("Error parsing JSON:", err);
      return new Response(null, { status: 500 });
    }

    const satellites = data.above;
    return new Response(JSON.stringify({ satellites }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(null, { status: 500 });
  }
}
