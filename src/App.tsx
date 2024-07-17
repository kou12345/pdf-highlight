import { ChangeEvent, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import { PDFDocumentProxy } from "pdfjs-dist";
import { jsPDF } from "jspdf";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const highlightLayerRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [pdfText, setPdfText] = useState<string>("");
  console.log(pdfText);

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

    // ハイライトしたい文章を指定（例：「特定の」という文字列を含む文章）
    const highlightKeywords = ["回線", "とは", "役目"];

    // Create highlights
    content.items.forEach((item) => {
      if ("str" in item) {
        console.log(item.str);
        // 特定の条件に合致する場合のみハイライトを作成
        if (highlightKeywords.some((keyword) => item.str.includes(keyword))) {
          console.log(item.str);
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

    // Extract text from PDF
    const extractedText = await extractTextFromPDF(pdfDoc);
    setPdfText(extractedText);

    renderPage(pdfDoc, 1);
  };

  const downloadHighlightedPDF = async () => {
    if (!pdfDoc || !canvasRef.current || !highlightLayerRef.current) return;

    const pdf = new jsPDF();

    for (let i = 1; i <= pdfDoc.numPages; i++) {
      await renderPage(pdfDoc, i);

      // Create a new canvas to combine PDF and highlights
      const combinedCanvas = document.createElement("canvas");
      combinedCanvas.width = canvasRef.current.width;
      combinedCanvas.height = canvasRef.current.height;
      const ctx = combinedCanvas.getContext("2d");
      if (!ctx) continue;

      // Draw the PDF page
      ctx.drawImage(canvasRef.current, 0, 0);

      // Draw the highlights
      const highlights = highlightLayerRef.current.children;
      ctx.fillStyle = "rgba(255, 255, 0, 0.3)";
      for (let j = 0; j < highlights.length; j++) {
        const highlight = highlights[j] as HTMLElement;
        ctx.fillRect(
          parseFloat(highlight.style.left),
          parseFloat(highlight.style.top),
          parseFloat(highlight.style.width),
          parseFloat(highlight.style.height)
        );
      }

      // Add the combined image to the PDF
      const imgData = combinedCanvas.toDataURL("image/jpeg", 1.0);
      pdf.addImage(
        imgData,
        "JPEG",
        0,
        0,
        pdf.internal.pageSize.getWidth(),
        pdf.internal.pageSize.getHeight()
      );

      if (i < pdfDoc.numPages) {
        pdf.addPage();
      }
    }

    pdf.save("highlighted_document.pdf");
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
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
        }}
      >
        <canvas ref={canvasRef} />
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
