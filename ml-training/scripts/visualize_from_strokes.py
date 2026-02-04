"""
Visualize the complete preprocessing pipeline starting from original Quick Draw strokes
Downloads .ndjson format and demonstrates the full pipeline: strokes → PIL → resize → crop
"""

import numpy as np
import matplotlib.pyplot as plt
from PIL import Image, ImageDraw
import json
import os
from pathlib import Path
import requests
from io import BytesIO
import gzip

# Configuration
CATEGORY = "cat"
OUTPUT_DIR = "./stroke_examples"
NUM_EXAMPLES = 3
CANVAS_SIZE = 255


def create_output_dir():
    """Create output directory"""
    Path(OUTPUT_DIR).mkdir(parents=True, exist_ok=True)
    print(f"✅ Output directory: {OUTPUT_DIR}")


def download_ndjson_sample(category: str, n_samples: int = 5):
    """
    Download a few samples from Quick Draw .ndjson format

    Quick Draw data is stored as:
    https://storage.googleapis.com/quickdraw_dataset/full/simplified/{category}.ndjson
    """
    url = f"https://storage.googleapis.com/quickdraw_dataset/full/simplified/{category}.ndjson"

    print(f"Downloading samples from Quick Draw API...")
    print(f"URL: {url}")

    try:
        response = requests.get(url, stream=True, timeout=30)
        response.raise_for_status()

        # Read first n_samples lines
        samples = []
        for i, line in enumerate(response.iter_lines()):
            if i >= n_samples:
                break
            if line:
                drawing_data = json.loads(line.decode("utf-8"))
                samples.append(drawing_data)

        print(f"✅ Downloaded {len(samples)} samples")
        return samples

    except Exception as e:
        print(f"❌ Error downloading: {e}")
        return None


def render_strokes_to_image(drawing_strokes, canvas_size=255):
    """
    Render Quick Draw strokes to PIL Image
    Fond noir avec strokes blancs

    Strokes format: [[[x1,x2,x3,...], [y1,y2,y3,...]], [...], ...]
    Each stroke is a list of [x_coords, y_coords]
    """
    # Create black canvas
    img = Image.new("L", (canvas_size, canvas_size), color=0)
    draw = ImageDraw.Draw(img)

    # Draw each stroke in white
    for stroke in drawing_strokes:
        x_coords = stroke[0]
        y_coords = stroke[1]

        # Create points list for PIL
        points = list(zip(x_coords, y_coords))

        if len(points) > 1:
            # Draw lines between consecutive points
            draw.line(points, fill=255, width=8)
        elif len(points) == 1:
            # Single point - draw a small circle
            x, y = points[0]
            draw.ellipse([x - 1, y - 1, x + 1, y + 1], fill=255)

    return img


def apply_centroid_crop(img_array: np.ndarray) -> np.ndarray:
    """
    Apply centroid-based cropping to align drawings
    Uses proper translation without circular wrap-around effects
    """
    if img_array.ndim == 1:
        img_array = img_array.reshape(28, 28)

    threshold = img_array > 230  # Pixels blancs > 230 (pour fond noir)

    if not threshold.any():
        return img_array

    # Calculate centroid
    y_indices, x_indices = np.nonzero(threshold)
    center_y = int(np.mean(y_indices))
    center_x = int(np.mean(x_indices))

    # Calculate shift to center
    shift_y = 14 - center_y
    shift_x = 14 - center_x

    # Create new image filled with black (0 for grayscale)
    shifted = np.full_like(img_array, 0)

    # Calculate source and destination slices
    # Source: what part of the original image to copy
    src_y_start = max(0, -shift_y)
    src_y_end = min(img_array.shape[0], img_array.shape[0] - shift_y)
    src_x_start = max(0, -shift_x)
    src_x_end = min(img_array.shape[1], img_array.shape[1] - shift_x)

    # Destination: where to place it in the new image
    dst_y_start = max(0, shift_y)
    dst_y_end = dst_y_start + (src_y_end - src_y_start)
    dst_x_start = max(0, shift_x)
    dst_x_end = dst_x_start + (src_x_end - src_x_start)

    # Copy the shifted region
    shifted[dst_y_start:dst_y_end, dst_x_start:dst_x_end] = img_array[
        src_y_start:src_y_end, src_x_start:src_x_end
    ]

    return shifted


def save_individual_images(
    drawing_data,
    sample_idx,
    img_255,
    img_28_array,
    img_cropped,
    img_normalized,
    img_final,
    centroid_x,
    centroid_y,
):
    """Save each step as individual image file"""
    word = drawing_data["word"]
    sample_dir = os.path.join(OUTPUT_DIR, f"sample_{sample_idx + 1}_individual_steps")
    Path(sample_dir).mkdir(parents=True, exist_ok=True)

    # Step 0: Strokes visualization
    fig, ax = plt.subplots(figsize=(6, 6))
    ax.set_xlim(0, 255)
    ax.set_ylim(0, 255)
    ax.invert_yaxis()
    ax.set_aspect("equal")
    colors = plt.cm.rainbow(np.linspace(0, 1, len(drawing_data["drawing"])))
    for i, stroke in enumerate(drawing_data["drawing"]):
        ax.plot(
            stroke[0], stroke[1], marker="o", markersize=2, linewidth=2, color=colors[i]
        )
    ax.set_title(
        f"Step 0: Strokes Vectoriels ({len(drawing_data['drawing'])} strokes)",
        fontsize=12,
    )
    ax.grid(alpha=0.3)
    plt.savefig(
        os.path.join(sample_dir, "step0_strokes_vectoriels.png"),
        dpi=150,
        bbox_inches="tight",
    )
    plt.close()

    # Step 1: Rendered 255x255
    img_255.save(os.path.join(sample_dir, "step1_rendu_255x255.png"))

    # Step 2: Resized 28x28
    Image.fromarray(img_28_array).save(
        os.path.join(sample_dir, "step2_resize_28x28.png")
    )

    # Step 3: Before crop (with centroid markers)
    fig, ax = plt.subplots(figsize=(6, 6))
    ax.imshow(img_28_array, cmap="gray")
    ax.plot(
        centroid_x,
        centroid_y,
        "r+",
        markersize=30,
        markeredgewidth=4,
        label=f"Centroïde ({centroid_x:.1f}, {centroid_y:.1f})",
    )
    ax.plot(14, 14, "g+", markersize=30, markeredgewidth=4, label="Cible (14, 14)")
    ax.set_title("Step 3: Avant Centroid Crop", fontsize=12)
    ax.legend(fontsize=10)
    ax.axis("off")
    plt.savefig(
        os.path.join(sample_dir, "step3_avant_crop_avec_centroide.png"),
        dpi=150,
        bbox_inches="tight",
    )
    plt.close()

    # Step 3b: Before crop (clean)
    Image.fromarray(img_28_array).save(os.path.join(sample_dir, "step3_avant_crop.png"))

    # Step 4: After crop
    Image.fromarray(img_cropped).save(os.path.join(sample_dir, "step4_apres_crop.png"))

    # Step 5: Normalized
    fig, ax = plt.subplots(figsize=(6, 6))
    ax.imshow(img_normalized, cmap="gray")
    ax.set_title(
        f"Step 5: Normalisé [0,1]\nmin={img_normalized.min():.3f}, max={img_normalized.max():.3f}",
        fontsize=12,
    )
    ax.axis("off")
    plt.savefig(
        os.path.join(sample_dir, "step5_normalise.png"), dpi=150, bbox_inches="tight"
    )
    plt.close()

    # Step 6: Final with channel
    fig, ax = plt.subplots(figsize=(6, 6))
    ax.imshow(img_final.squeeze(), cmap="gray")
    ax.set_title(f"Step 6: Format Final CNN\nShape: {img_final.shape}", fontsize=12)
    ax.axis("off")
    plt.savefig(
        os.path.join(sample_dir, "step6_final_cnn.png"), dpi=150, bbox_inches="tight"
    )
    plt.close()

    print(f"✅ Saved individual step images in: {sample_dir}")


def visualize_complete_pipeline(drawing_data, sample_idx):
    """
    Visualize complete pipeline from original strokes
    """
    word = drawing_data["word"]
    strokes = drawing_data["drawing"]
    recognized = drawing_data.get("recognized", "N/A")
    country = drawing_data.get("countrycode", "N/A")

    print(f"\n{'=' * 60}")
    print(f"Sample #{sample_idx + 1}")
    print(f"Word: {word}")
    print(f"Recognized: {recognized}")
    print(f"Country: {country}")
    print(f"Number of strokes: {len(strokes)}")
    print(f"{'=' * 60}")

    # Step 1: Render strokes to 255x255
    img_255 = render_strokes_to_image(strokes, canvas_size=255)

    # Step 2: Convert to numpy and resize to 28x28
    img_255_array = np.array(img_255)
    img_28 = img_255.resize((28, 28), Image.Resampling.LANCZOS)
    img_28_array = np.array(img_28)

    # Step 3: Apply centroid crop
    img_cropped = apply_centroid_crop(img_28_array)

    # Step 4: Normalize
    img_normalized = img_cropped.astype(np.float32) / 255.0

    # Step 5: Add channel dimension
    img_final = np.expand_dims(img_normalized, axis=-1)

    # Calculate centroid info
    threshold = img_28_array > 230  # Ajusté pour fond noir
    if threshold.any():
        y_indices, x_indices = np.nonzero(threshold)
        centroid_x = np.mean(x_indices)
        centroid_y = np.mean(y_indices)
    else:
        centroid_x, centroid_y = 14, 14

    # Save individual images for each step
    save_individual_images(
        drawing_data,
        sample_idx,
        img_255,
        img_28_array,
        img_cropped,
        img_normalized,
        img_final,
        centroid_x,
        centroid_y,
    )

    # Create visualization
    fig = plt.figure(figsize=(18, 12))
    gs = fig.add_gridspec(3, 3, hspace=0.3, wspace=0.3)

    # Title
    fig.suptitle(
        f"Pipeline Complet depuis Strokes Originaux - {word.title()} #{sample_idx + 1}",
        fontsize=16,
        fontweight="bold",
    )

    # Step 0: Raw strokes visualization
    ax0 = fig.add_subplot(gs[0, 0])
    ax0.set_xlim(0, 255)
    ax0.set_ylim(0, 255)
    ax0.invert_yaxis()
    ax0.set_aspect("equal")
    colors = plt.cm.rainbow(np.linspace(0, 1, len(strokes)))
    for i, stroke in enumerate(strokes):
        x_coords = stroke[0]
        y_coords = stroke[1]
        ax0.plot(
            x_coords,
            y_coords,
            marker="o",
            markersize=2,
            linewidth=2,
            color=colors[i],
            label=f"Stroke {i + 1}",
        )
    ax0.set_title(f"0. Strokes Vectoriels\n{len(strokes)} strokes", fontsize=11)
    ax0.grid(alpha=0.3)
    if len(strokes) <= 5:
        ax0.legend(fontsize=8)

    # Step 1: Rendered 255x255
    ax1 = fig.add_subplot(gs[0, 1])
    ax1.imshow(img_255, cmap="gray")
    ax1.set_title("1. Rendu PIL\n255×255 pixels", fontsize=11)
    ax1.axis("off")

    # Step 2: Resized 28x28
    ax2 = fig.add_subplot(gs[0, 2])
    ax2.imshow(img_28, cmap="gray")
    ax2.set_title("2. Resize LANCZOS\n28×28 pixels", fontsize=11)
    ax2.axis("off")

    # Step 3: Centroid visualization (before crop)
    ax3 = fig.add_subplot(gs[1, 0])
    ax3.imshow(img_28_array, cmap="gray")
    ax3.plot(
        centroid_x,
        centroid_y,
        "r+",
        markersize=20,
        markeredgewidth=3,
        label="Centroïde",
    )
    ax3.plot(14, 14, "g+", markersize=20, markeredgewidth=3, label="Cible (14,14)")
    ax3.set_title(
        f"3. Avant Crop\nCentroïde: ({centroid_x:.1f}, {centroid_y:.1f})", fontsize=11
    )
    ax3.legend(fontsize=8)
    ax3.axis("off")

    # Step 4: After centroid crop
    ax4 = fig.add_subplot(gs[1, 1])
    ax4.imshow(img_cropped, cmap="gray")
    ax4.plot(14, 14, "g+", markersize=20, markeredgewidth=3, label="Centré")
    ax4.set_title("4. Après Centroid Crop\nRecentré à (14,14)", fontsize=11)
    ax4.legend(fontsize=8)
    ax4.axis("off")

    # Step 5: Normalized
    ax5 = fig.add_subplot(gs[1, 2])
    ax5.imshow(img_normalized, cmap="gray")
    ax5.set_title(
        f"5. Normalisé [0,1]\nmin={img_normalized.min():.3f}, max={img_normalized.max():.3f}",
        fontsize=11,
    )
    ax5.axis("off")

    # Step 6: Final format
    ax6 = fig.add_subplot(gs[2, 0])
    ax6.imshow(img_final.squeeze(), cmap="gray")
    ax6.set_title(f"6. Format Final\nShape: {img_final.shape}", fontsize=11)
    ax6.axis("off")

    # Metadata panel
    ax7 = fig.add_subplot(gs[2, 1:])
    ax7.axis("off")
    metadata_text = f"""
    MÉTADONNÉES DE L'EXEMPLE
    ━━━━━━━━━━━━━━━━━━━━━━━
    
    • Catégorie: {word}
    • Reconnu par Google: {recognized}
    • Pays: {country}
    • Nombre de strokes: {len(strokes)}
    • Format original: Strokes vectoriels (coordonnées [0-255])
    • Canvas size: 255×255 pixels
    
    PIPELINE APPLIQUÉ
    ━━━━━━━━━━━━━━━━━
    0. Strokes vectoriels → Liste de coordonnées [x], [y]
    1. Rendu PIL → ImageDraw.line() avec stroke_width=2
    2. Resize → LANCZOS antialiasing 255×255 → 28×28
    3. Centroid Crop → Calcul barycentre + np.roll()
    4. Normalisation → [0-255] → [0.0-1.0] (float32)
    5. Format CNN → Ajout dimension canal (28,28,1)
    
    STATISTIQUES
    ━━━━━━━━━━━━━
    • Centroïde avant crop: ({centroid_x:.1f}, {centroid_y:.1f})
    • Shift appliqué: ({14 - centroid_x:.1f}, {14 - centroid_y:.1f})
    • Pixels non-blancs: {np.sum(img_normalized > 0.1)}/{28 * 28}
    • Intensité moyenne: {img_normalized.mean():.3f}
    """
    ax7.text(
        0.05,
        0.95,
        metadata_text,
        transform=ax7.transAxes,
        fontsize=10,
        verticalalignment="top",
        family="monospace",
        bbox=dict(boxstyle="round", facecolor="wheat", alpha=0.3),
    )

    plt.tight_layout()
    output_path = os.path.join(
        OUTPUT_DIR, f"complete_pipeline_{word}_{sample_idx + 1}.png"
    )
    plt.savefig(output_path, dpi=150, bbox_inches="tight")
    plt.close()

    print(f"✅ Saved: {output_path}")

    return img_final


def save_stroke_json_example(drawing_data, sample_idx):
    """Save a pretty-printed JSON example of the stroke format"""
    output_path = os.path.join(OUTPUT_DIR, f"stroke_example_{sample_idx + 1}.json")

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(drawing_data, f, indent=2, ensure_ascii=False)

    print(f"✅ Saved JSON: {output_path}")


def main():
    print("=" * 60)
    print("VISUALISATION DU PIPELINE DEPUIS STROKES ORIGINAUX")
    print(f"Catégorie: {CATEGORY}")
    print("=" * 60)
    print()

    create_output_dir()

    # Download samples
    samples = download_ndjson_sample(CATEGORY, NUM_EXAMPLES)

    if not samples:
        print("❌ Impossible de télécharger les échantillons")
        print("\nAlternative: Téléchargez manuellement depuis:")
        print(
            f"https://storage.googleapis.com/quickdraw_dataset/full/simplified/{CATEGORY}.ndjson"
        )
        return

    print(f"\nTraitement de {len(samples)} échantillons...\n")

    # Process each sample
    for i, drawing_data in enumerate(samples):
        visualize_complete_pipeline(drawing_data, i)
        save_stroke_json_example(drawing_data, i)

    # Create comparison visualization
    create_comparison_visual(samples)

    print("\n" + "=" * 60)
    print("✅ GÉNÉRATION TERMINÉE")
    print("=" * 60)
    print(f"\nFichiers générés dans: {OUTPUT_DIR}/")
    print(f"  • complete_pipeline_cat_1.png (×{len(samples)})")
    print(f"  • stroke_example_1.json (×{len(samples)})")
    print(f"  • format_comparison.png")
    print(
        "\nCes visualisations montrent le VRAI pipeline depuis les strokes originaux! 🎨"
    )


def create_comparison_visual(samples):
    """Create a comparison showing all steps side by side"""
    n_samples = min(3, len(samples))

    fig, axes = plt.subplots(n_samples, 6, figsize=(18, 3 * n_samples))
    if n_samples == 1:
        axes = axes.reshape(1, -1)

    fig.suptitle(
        "Comparaison du Pipeline Complet - Strokes → Image Finale",
        fontsize=14,
        fontweight="bold",
    )

    steps = [
        "Strokes",
        "Rendu\n255×255",
        "Resize\n28×28",
        "Avant\nCrop",
        "Après\nCrop",
        "Final",
    ]

    for i, drawing_data in enumerate(samples[:n_samples]):
        strokes = drawing_data["drawing"]
        word = drawing_data["word"]

        # Step 0: Strokes
        axes[i, 0].set_xlim(0, 255)
        axes[i, 0].set_ylim(0, 255)
        axes[i, 0].invert_yaxis()
        for stroke in strokes:
            axes[i, 0].plot(stroke[0], stroke[1], linewidth=1)
        axes[i, 0].set_title(f"{steps[0]}\n({len(strokes)} strokes)", fontsize=9)
        axes[i, 0].axis("off")

        # Step 1: Rendered
        img_255 = render_strokes_to_image(strokes, 255)
        axes[i, 1].imshow(img_255, cmap="gray")
        axes[i, 1].set_title(steps[1], fontsize=9)
        axes[i, 1].axis("off")

        # Step 2: Resized
        img_28 = img_255.resize((28, 28), Image.Resampling.LANCZOS)
        img_28_array = np.array(img_28)
        axes[i, 2].imshow(img_28_array, cmap="gray")
        axes[i, 2].set_title(steps[2], fontsize=9)
        axes[i, 2].axis("off")

        # Step 3: Before crop
        axes[i, 3].imshow(img_28_array, cmap="gray")
        axes[i, 3].set_title(steps[3], fontsize=9)
        axes[i, 3].axis("off")

        # Step 4: After crop
        img_cropped = apply_centroid_crop(img_28_array)
        axes[i, 4].imshow(img_cropped, cmap="gray")
        axes[i, 4].set_title(steps[4], fontsize=9)
        axes[i, 4].axis("off")

        # Step 5: Final
        img_normalized = img_cropped.astype(np.float32) / 255.0
        axes[i, 5].imshow(img_normalized, cmap="gray")
        axes[i, 5].set_title(steps[5], fontsize=9)
        axes[i, 5].axis("off")

        # Row label
        axes[i, 0].text(
            -0.1,
            0.5,
            f"{word.title()} #{i + 1}",
            transform=axes[i, 0].transAxes,
            fontsize=10,
            fontweight="bold",
            rotation=90,
            verticalalignment="center",
        )

    plt.tight_layout()
    output_path = os.path.join(OUTPUT_DIR, "format_comparison.png")
    plt.savefig(output_path, dpi=150, bbox_inches="tight")
    plt.close()

    print(f"✅ Saved comparison: {output_path}")


if __name__ == "__main__":
    main()
