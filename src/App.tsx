import { ChangeEvent, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import { PDFDocumentProxy } from "pdfjs-dist";
import { jsPDF } from "jspdf";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

/*
[x0, x1, y0, y1]
*/
const coordinates = [
  [78.3569, 557.9994082, 137.3699356, 631.74292],
  [68.459, 539.6823124, 188.54441456, 551.8092124],
  [68.1953, 508.45457960000005, 148.68414791, 537.6796796000001],
  [68.9043, 496.3515196, 90.15819150000002, 509.1166196],
  [199.6616, 485.2929383, 285.52610000000004, 532.1236383],
  [197.1006, 484.46853560000005, 290.10348999999997, 496.4159356],
  [301.8086, 517.6179271000001, 389.1425923, 600.5457588],
  [189.15865, 494.63550931, 197.40675000000002, 543.092272],
  [199.6616, 485.2929383, 285.52610000000004, 532.1236383],
  [197.1006, 484.46853560000005, 290.10348999999997, 496.4159356],
];

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const highlightLayerRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [pdfText, setPdfText] = useState<string>("");
  const [pdfSize, setPdfSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const renderPage = async (pdf: PDFDocumentProxy, pageNum: number) => {
    if (!canvasRef.current || !highlightLayerRef.current) return;

    const page = await pdf.getPage(pageNum);
    const scale = 3;
    const viewport = page.getViewport({ scale });

    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    if (!context) return;

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };

    await page.render(renderContext).promise;

    // Clear previous highlights
    highlightLayerRef.current.innerHTML = "";

    // Get text content
    const content = await page.getTextContent();

    // ハイライトしたい文章を指定
    const highlightKeywords = ["回線", "とは", "役目", "梅雨", "梅"];

    // Create highlights
    content.items.forEach((item) => {
      if ("str" in item) {
        // 特定の条件に合致する場合のみハイライトを作成
        if (highlightKeywords.some((keyword) => item.str.includes(keyword))) {
          const highlight = document.createElement("div");
          highlight.style.position = "absolute";

          // スケールを考慮した座標計算
          const [, , , , x, y] = item.transform;
          const scaledX = x * scale;
          const scaledY = viewport.height - y * scale;
          const scaledWidth = item.width * scale;
          const scaledHeight = item.height * scale;

          highlight.style.left = `${scaledX}px`;
          highlight.style.top = `${scaledY - scaledHeight}px`;
          highlight.style.width = `${scaledWidth}px`;
          highlight.style.height = `${scaledHeight}px`;
          highlight.style.backgroundColor = "yellow";
          highlight.style.opacity = "0.3";
          highlight.style.pointerEvents = "none";
          highlightLayerRef.current?.appendChild(highlight);
        }
      }
    });

    // Draw all red rectangles
    coordinates.forEach(([x0, y0, x1, y1]) => {
      const rectWidth = (x1 - x0) * scale;
      const rectHeight = (y1 - y0) * scale;
      const rectX = x0 * scale;
      const rectY = viewport.height - y1 * scale; // Flip Y-coordinate

      context.fillStyle = "rgba(255, 0, 0, 0.2)";
      context.fillRect(rectX, rectY, rectWidth, rectHeight);

      context.strokeStyle = "red";
      context.lineWidth = 2;
      context.strokeRect(rectX, rectY, rectWidth, rectHeight);
    });

    // Draw text for the first rectangle (you can modify this as needed)
    const [x0, y0, x1, y1] = coordinates[0];
    const rectX = x0 * scale;
    const rectY = viewport.height - y1 * scale;

    context.font = "54px sans-serif";
    context.fillStyle = "red";
    context.fillText("This is a red rectangle 検証だ!!!", rectX, rectY - 10);
  };

  const extractTextFromPDF = async (pdf: PDFDocumentProxy) => {
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => {
          if ("str" in item) return item.str;
          return "";
        })
        .join(" ");
      text += pageText + "\n";
    }
    return text;
  };

  const onChangeInput = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) {
      return;
    }

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjs.getDocument({
      data: arrayBuffer,
      cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
      cMapPacked: true,
    });
    const pdfDoc = await loadingTask.promise;
    setPdfDoc(pdfDoc);

    // Get PDF size
    const page = await pdfDoc.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    setPdfSize({ width: viewport.width, height: viewport.height });

    // Extract text from PDF
    const extractedText = await extractTextFromPDF(pdfDoc);
    setPdfText(extractedText);

    renderPage(pdfDoc, 1);
  };

  const downloadHighlightedPDF = async () => {
    // 必要な要素が全て存在するか確認
    if (!pdfDoc || !canvasRef.current || !highlightLayerRef.current || !pdfSize)
      return;

    // 新しいJSPDFインスタンスを作成
    // ページの向き、単位、サイズを設定
    const pdf = new jsPDF({
      orientation: pdfSize.width > pdfSize.height ? "landscape" : "portrait",
      unit: "pt",
      format: [pdfSize.width, pdfSize.height],
    });

    // PDFの各ページを処理
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      // ページをレンダリング（ハイライトと長方形を含む）
      await renderPage(pdfDoc, i);

      // PDFとハイライトを組み合わせるための新しいキャンバスを作成
      const combinedCanvas = document.createElement("canvas");
      combinedCanvas.width = canvasRef.current.width;
      combinedCanvas.height = canvasRef.current.height;
      const ctx = combinedCanvas.getContext("2d");
      if (!ctx) continue;

      // レンダリングされたPDFページ（赤い長方形とハイライトを含む）を描画
      ctx.drawImage(canvasRef.current, 0, 0);

      // 組み合わせた画像をPDFに追加
      const imgData = combinedCanvas.toDataURL("image/jpeg", 1.0);
      pdf.addImage(imgData, "JPEG", 0, 0, pdfSize.width, pdfSize.height);

      // // 注釈を追加
      // const [x0, y0, x1, y1] = coordinate;
      // pdf.createAnnotation({
      //   type: "text",
      //   title: "Note",
      //   bounds: {
      //     x: x0,
      //     y: pdfSize.height - y1, // Y座標を反転
      //     w: x1 - x0,
      //     h: y1 - y0,
      //   },
      //   contents: "This is a note",
      //   open: false,
      // });

      // 最後のページでなければ、新しいページを追加
      if (i < pdfDoc.numPages) {
        pdf.addPage();
      }
    }

    // 修正されたPDFを保存
    pdf.save("highlighted_document.pdf");
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <input
        type="file"
        accept=".pdf"
        onChange={(e) => onChangeInput(e)}
        style={{ marginBottom: "20px" }}
      />
      <button
        onClick={downloadHighlightedPDF}
        disabled={!pdfDoc}
        style={{ marginBottom: "20px" }}
      >
        Download Highlighted PDF
      </button>
      <div
        style={{
          position: "relative",
          width: "100%",
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            width: "100%",
            height: "auto",
          }}
        />
        <div
          ref={highlightLayerRef}
          style={{ position: "absolute", top: 0, left: 0 }}
        />
      </div>

      <div
        style={{ marginTop: "20px", maxWidth: "800px", wordWrap: "break-word" }}
      >
        <h3>Extracted Text:</h3>
        <pre>{pdfText}</pre>
      </div>
    </div>
  );
}

export default App;
