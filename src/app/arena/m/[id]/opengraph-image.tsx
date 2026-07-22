import { ImageResponse } from "next/og";
import { getCuratedMarkets, findMarket } from "@/lib/poly";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Amiractive Prediction Arena";

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const market = findMarket(await getCuratedMarkets(), id);

  const question = market?.question ?? "Prediction Arena";
  const yes = market?.yesPct ?? 50;
  const no = Math.round((100 - yes) * 10) / 10;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #0a0a0c 0%, #16161c 100%)",
          color: "#f4f1e8",
          padding: 64,
          justifyContent: "space-between",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 34,
              fontWeight: 800,
              letterSpacing: 8,
              color: "#e8c46a",
            }}
          >
            AMIRACTIVE
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 20,
              letterSpacing: 5,
              color: "#8f8c85",
            }}
          >
            PREDICTION ARENA
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: question.length > 70 ? 40 : 50,
            fontWeight: 700,
            lineHeight: 1.35,
            maxWidth: 1000,
          }}
        >
          {question}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 30,
              fontWeight: 700,
            }}
          >
            <div style={{ display: "flex", color: "#3ecf8e" }}>Yes {yes}%</div>
            <div style={{ display: "flex", color: "#e5484d" }}>No {no}%</div>
          </div>
          <div
            style={{
              display: "flex",
              width: "100%",
              height: 18,
              borderRadius: 9,
              background: "rgba(229,72,77,0.3)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                width: `${yes}%`,
                height: "100%",
                background: "#3ecf8e",
                borderRadius: 9,
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 20,
              color: "#8f8c85",
            }}
          >
            <div style={{ display: "flex" }}>Predict. Earn points. Get funded.</div>
            <div style={{ display: "flex", color: "#e8c46a" }}>amiractive.com</div>
          </div>
        </div>
      </div>
    ),
    size
  );
}
