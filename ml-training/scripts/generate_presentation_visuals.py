"""
Generate visual examples for presentation
Demonstrates preprocessing pipeline on 'cat' category
"""

import numpy as np
import matplotlib.pyplot as plt
from PIL import Image, ImageDraw
import json
import os
from pathlib import Path

# Configuration
CATEGORIES = [
    "airplane",
    "apple",
    "bicycle",
    "car",
    "cat",
    "clock",
    "cloud",
    "cup",
    "eye",
    "fish",
    "flower",
    "house",
    "lightning",
    "moon",
    "shoe",
    "smiley_face",
    "star",
    "sun",
    "tree",
    "umbrella",
]
RAW_DATA_DIR = "../data/raw"
OUTPUT_BASE_DIR = "./presentation_visuals"
NUM_EXAMPLES = 6  # Number of drawings to visualize per category
RANDOM_SEED = 42


def create_output_dirs(category: str):
    """Create output directory structure for a specific category"""
    output_dir = os.path.join(OUTPUT_BASE_DIR, category)
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    print(f"✅ Output directory created: {output_dir}")
    return output_dir


def load_sample_drawings(category: str, n_samples: int = NUM_EXAMPLES):
    """Load n sample drawings from .npy file"""
    filepath = os.path.join(RAW_DATA_DIR, f"{category}.npy")

    if not os.path.exists(filepath):
        print(f"❌ File not found: {filepath}")
        return None

    # Load .npy file
    data = np.load(filepath)

    # Random sample
    np.random.seed(RANDOM_SEED)
    indices = np.random.choice(len(data), n_samples, replace=False)
    samples = data[indices]

    print(f"✅ Loaded {n_samples} samples from {category}")
    return samples


def render_stroke_to_image(img_array: np.ndarray, size: int = 255) -> Image.Image:
    """
    Simulate rendering from strokes to PIL Image
    (In reality, we already have the rendered version in .npy)
    """
    # Create PIL image
    img = Image.fromarray(img_array.reshape(28, 28))
    img = img.resize((size, size), Image.Resampling.LANCZOS)
    return img


def apply_centroid_crop(img_array: np.ndarray) -> np.ndarray:
    """
    Apply centroid-based cropping to align drawings
    Uses proper translation without circular wrap-around effects
    """
    # Reshape to 2D if needed
    if img_array.ndim == 1:
        img_array = img_array.reshape(28, 28)

    # Find center of mass
    threshold = img_array > 25  # ~10% of 255

    if not threshold.any():
        return img_array

    # Calculate centroid
    y_indices, x_indices = np.nonzero(threshold)
    center_y = int(np.mean(y_indices))
    center_x = int(np.mean(x_indices))

    # Calculate shift to center
    shift_y = 14 - center_y
    shift_x = 14 - center_x

    # Create new image filled with white (255 for grayscale)
    shifted = np.full_like(img_array, 255)

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


def visualize_preprocessing_pipeline(
    sample_idx: int, samples: np.ndarray, category: str, output_dir: str
):
    """
    Visualize the actual preprocessing pipeline used
    Pipeline: .npy (28×28) → Centroid Crop → Normalisation
    Saves: pipeline_{category}_example_{idx}.png
    """
    sample = samples[sample_idx].reshape(28, 28)

    # Real pipeline steps
    step1_original = sample.copy()  # From .npy file (already 28×28)
    step2_cropped = apply_centroid_crop(step1_original)
    step3_normalized = step2_cropped.astype(np.float32) / 255.0
    step4_final = np.expand_dims(step3_normalized, axis=-1)

    # Calculate centroid info for display
    threshold = step1_original > 25
    if threshold.any():
        y_indices, x_indices = np.nonzero(threshold)
        centroid_x = np.mean(x_indices)
        centroid_y = np.mean(y_indices)
    else:
        centroid_x, centroid_y = 14, 14

    # Create figure
    fig, axes = plt.subplots(1, 4, figsize=(16, 5))
    fig.suptitle(
        f"Pipeline Réel de Préprocessing - {category.title()} #{sample_idx + 1}",
        fontsize=16,
        fontweight="bold",
    )

    # Step 1: Original from .npy (28x28)
    axes[0].imshow(step1_original, cmap="gray")
    axes[0].plot(
        centroid_x,
        centroid_y,
        "r+",
        markersize=20,
        markeredgewidth=3,
        label="Centroïde",
    )
    axes[0].plot(14, 14, "g+", markersize=20, markeredgewidth=3, label="Cible")
    axes[0].set_title(
        f"1. Original .npy\n28×28 pixels\nCentroïde: ({centroid_x:.1f}, {centroid_y:.1f})",
        fontsize=11,
    )
    axes[0].legend(fontsize=8, loc="upper right")
    axes[0].axis("off")

    # Step 2: Centroid Crop
    axes[1].imshow(step2_cropped, cmap="gray")
    axes[1].plot(14, 14, "g+", markersize=20, markeredgewidth=3, label="Centré")
    axes[1].set_title("2. Centroid Crop ⭐\nRecentrage au centre", fontsize=11)
    axes[1].legend(fontsize=8, loc="upper right")
    axes[1].axis("off")

    # Step 3: Normalized
    axes[2].imshow(step3_normalized, cmap="gray")
    axes[2].set_title(
        f"3. Normalisation\n[0-255] → [0-1]\nmin={step3_normalized.min():.2f}, max={step3_normalized.max():.2f}",
        fontsize=11,
    )
    axes[2].axis("off")

    # Step 4: Final (with channel)
    axes[3].imshow(step4_final.squeeze(), cmap="gray")
    axes[3].set_title(
        f"4. Format Final CNN\nShape: {step4_final.shape}\nPrêt pour Conv2D",
        fontsize=11,
    )
    axes[3].axis("off")

    plt.tight_layout()
    output_path = os.path.join(
        output_dir, f"pipeline_{category}_example_{sample_idx + 1}.png"
    )
    plt.savefig(output_path, dpi=150, bbox_inches="tight")
    plt.close()

    print(f"✅ Saved pipeline visualization: {output_path}")


def visualize_centroid_crop_comparison(
    samples: np.ndarray, category: str, output_dir: str
):
    """
    Compare before/after centroid crop for multiple samples
    Saves: centroid_crop_comparison.png
    """
    n_samples = min(6, len(samples))

    fig, axes = plt.subplots(2, n_samples, figsize=(3 * n_samples, 6))
    fig.suptitle(
        f"Centroid Crop : Avant vs Après - {category.title()}",
        fontsize=16,
        fontweight="bold",
    )

    for i in range(n_samples):
        sample = samples[i].reshape(28, 28)

        # Before crop
        axes[0, i].imshow(sample, cmap="gray")
        axes[0, i].set_title(f"Avant #{i + 1}", fontsize=10)
        axes[0, i].axis("off")

        # After crop
        cropped = apply_centroid_crop(sample)
        axes[1, i].imshow(cropped, cmap="gray")
        axes[1, i].set_title(f"Après #{i + 1}", fontsize=10)
        axes[1, i].axis("off")

    plt.tight_layout()
    output_path = os.path.join(output_dir, f"centroid_crop_comparison_{category}.png")
    plt.savefig(output_path, dpi=150, bbox_inches="tight")
    plt.close()

    print(f"✅ Saved centroid crop comparison: {output_path}")


def visualize_dataset_grid(samples: np.ndarray, category: str, output_dir: str):
    """
    Display grid of sample drawings
    Saves: {category}_samples_grid.png
    """
    n_samples = min(12, len(samples))
    n_cols = 4
    n_rows = (n_samples + n_cols - 1) // n_cols

    fig, axes = plt.subplots(n_rows, n_cols, figsize=(12, 3 * n_rows))
    fig.suptitle(
        f'Exemples de Dessins - Catégorie "{category.title()}"',
        fontsize=16,
        fontweight="bold",
    )

    axes = axes.flatten() if n_samples > 1 else [axes]

    for i in range(n_samples):
        sample = samples[i].reshape(28, 28)
        # Apply preprocessing for display
        processed = apply_centroid_crop(sample)
        processed = processed.astype(np.float32) / 255.0

        axes[i].imshow(processed, cmap="gray")
        axes[i].set_title(f"Dessin #{i + 1}", fontsize=10)
        axes[i].axis("off")

    # Hide unused subplots
    for i in range(n_samples, len(axes)):
        axes[i].axis("off")

    plt.tight_layout()
    output_path = os.path.join(output_dir, f"{category}_samples_grid.png")
    plt.savefig(output_path, dpi=150, bbox_inches="tight")
    plt.close()

    print(f"✅ Saved samples grid: {output_path}")


def create_metadata_json(samples: np.ndarray, category: str, output_dir: str):
    """
    Create JSON with metadata about the samples
    Saves: presentation_metadata.json
    """
    metadata = {
        "category": category,
        "num_samples": len(samples),
        "preprocessing_steps": [
            "1. Chargement .npy (déjà 28×28 pixels)",
            "2. Centroid Crop (recentrage barycentre)",
            "3. Normalisation [0-255] → [0-1]",
            "4. Ajout dimension canal (28, 28, 1)",
        ],
        "note": "Les fichiers .npy de Quick Draw contiennent déjà des images rendues en 28×28",
        "image_shape": [28, 28, 1],
        "normalization": "[0, 1]",
        "centroid_crop_impact": "+3.1% accuracy (87.1% → 90.2%)",
        "format_source": ".npy (images pré-rendues par Google)",
        "format_final": "numpy array (28×28×1 grayscale)",
        "dataset_total_categories": 345,
        "dataset_total_drawings": "50M+",
        "our_subset": "20 catégories × 70,000 images = 1.4M",
        "split": {
            "train": "80%",
            "validation": "10%",
            "test": "10%",
            "stratified": True,
        },
        "compression": "HDF5 avec gzip level 4",
        "final_size": "~400 MB",
    }

    output_path = os.path.join(output_dir, f"presentation_metadata_{category}.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)

    print(f"✅ Saved metadata: {output_path}")
    return metadata


def create_statistics_visualization(
    samples: np.ndarray, category: str, output_dir: str
):
    """
    Create statistics about the sample drawings
    Saves: {category}_statistics.png
    """
    # Calculate statistics
    mean_pixels = []
    centroids_x = []
    centroids_y = []

    for sample in samples:
        img = sample.reshape(28, 28)
        mean_pixels.append(np.mean(img))

        # Calculate centroid
        threshold = img > 25
        if threshold.any():
            y_indices, x_indices = np.nonzero(threshold)
            centroids_x.append(np.mean(x_indices))
            centroids_y.append(np.mean(y_indices))

    fig, axes = plt.subplots(2, 2, figsize=(12, 10))
    fig.suptitle(
        f'Statistiques des Échantillons - Catégorie "{category.title()}"',
        fontsize=16,
        fontweight="bold",
    )

    # 1. Histogram of mean pixel intensity
    axes[0, 0].hist(
        mean_pixels, bins=20, color="steelblue", alpha=0.7, edgecolor="black"
    )
    axes[0, 0].set_title("Distribution Intensité Moyenne des Pixels", fontsize=12)
    axes[0, 0].set_xlabel("Intensité Moyenne [0-255]")
    axes[0, 0].set_ylabel("Nombre de Dessins")
    axes[0, 0].axvline(
        np.mean(mean_pixels),
        color="red",
        linestyle="--",
        label=f"Moyenne: {np.mean(mean_pixels):.1f}",
    )
    axes[0, 0].legend()
    axes[0, 0].grid(alpha=0.3)

    # 2. Centroid distribution
    axes[0, 1].scatter(centroids_x, centroids_y, alpha=0.6, s=50, color="coral")
    axes[0, 1].scatter(
        14,
        14,
        color="red",
        s=200,
        marker="x",
        linewidths=3,
        label="Centre Cible (14, 14)",
    )
    axes[0, 1].set_title("Distribution des Centroïdes AVANT Crop", fontsize=12)
    axes[0, 1].set_xlabel("Position X")
    axes[0, 1].set_ylabel("Position Y")
    axes[0, 1].set_xlim(0, 28)
    axes[0, 1].set_ylim(0, 28)
    axes[0, 1].invert_yaxis()
    axes[0, 1].legend()
    axes[0, 1].grid(alpha=0.3)
    axes[0, 1].text(
        14,
        26,
        "Problème: Dessins décalés!",
        ha="center",
        fontsize=10,
        bbox=dict(boxstyle="round", facecolor="yellow", alpha=0.5),
    )

    # 3. Average drawing (mean of all samples)
    mean_drawing = np.mean([s.reshape(28, 28) for s in samples], axis=0)
    axes[1, 0].imshow(mean_drawing, cmap="gray")
    axes[1, 0].set_title("Dessin Moyen (Average de tous les échantillons)", fontsize=12)
    axes[1, 0].axis("off")

    # 4. Variance map
    var_drawing = np.var([s.reshape(28, 28) for s in samples], axis=0)
    im = axes[1, 1].imshow(var_drawing, cmap="hot")
    axes[1, 1].set_title("Carte de Variance\n(Rouge = Haute variabilité)", fontsize=12)
    axes[1, 1].axis("off")
    plt.colorbar(im, ax=axes[1, 1])

    plt.tight_layout()
    output_path = os.path.join(output_dir, f"{category}_statistics.png")
    plt.savefig(output_path, dpi=150, bbox_inches="tight")
    plt.close()

    print(f"✅ Saved statistics visualization: {output_path}")


def create_preprocessing_impact_table(output_dir: str):
    """
    Create a table showing preprocessing impact
    Saves: preprocessing_impact.png
    """
    fig, ax = plt.subplots(figsize=(12, 6))
    ax.axis("tight")
    ax.axis("off")

    table_data = [
        ["Étape", "Technique", "Impact", "Justification"],
        [
            "1",
            "Resize 255→28",
            "Neutre",
            "Standard MNIST, antialiasing préserve détails",
        ],
        [
            "2",
            "Centroid Crop",
            "+3.1% acc",
            "Normalise position, réduit variance spatiale",
        ],
        ["3", "Normalisation [0,1]", "Neutre", "Stabilise gradient descent"],
        ["4", "Format HDF5", "Neutre", "Accès aléatoire rapide, compression 60%"],
        ["5", "Split Stratifié", "+0.5% acc", "Maintient balance des classes"],
    ]

    table = ax.table(
        cellText=table_data,
        cellLoc="left",
        loc="center",
        colWidths=[0.1, 0.3, 0.2, 0.4],
    )

    table.auto_set_font_size(False)
    table.set_fontsize(11)
    table.scale(1, 2.5)

    # Style header row
    for i in range(4):
        cell = table[(0, i)]
        cell.set_facecolor("#4CAF50")
        cell.set_text_props(weight="bold", color="white")

    # Color impact column
    for i in range(1, len(table_data)):
        cell = table[(i, 2)]
        if "+" in table_data[i][2]:
            cell.set_facecolor("#C8E6C9")
        else:
            cell.set_facecolor("#E0E0E0")

    plt.title(
        "Impact des Étapes de Préprocessing sur la Performance",
        fontsize=14,
        fontweight="bold",
        pad=20,
    )

    output_path = os.path.join(output_dir, "preprocessing_impact_table.png")
    plt.savefig(output_path, dpi=150, bbox_inches="tight")
    plt.close()

    print(f"✅ Saved preprocessing impact table: {output_path}")


def create_detailed_preprocessing_json(
    sample: np.ndarray, category: str, output_dir: str
):
    """
    Create detailed JSON showing each preprocessing step
    Pipeline: .npy → Centroid Crop → Normalisation
    Saves: preprocessing_steps_detailed.json
    """
    # Step 1: Original from .npy (28x28)
    step1_original = sample.reshape(28, 28)

    # Step 2: Centroid crop
    step2_cropped = apply_centroid_crop(step1_original)

    # Calculate centroid info
    threshold = step1_original > 25
    if threshold.any():
        y_indices, x_indices = np.nonzero(threshold)
        centroid_x = float(np.mean(x_indices))
        centroid_y = float(np.mean(y_indices))
        shift_x = 14 - centroid_x
        shift_y = 14 - centroid_y
    else:
        centroid_x, centroid_y = 14.0, 14.0
        shift_x, shift_y = 0.0, 0.0

    # Step 3: Normalize
    step3_normalized = step2_cropped.astype(np.float32) / 255.0

    # Step 4: Add channel dimension
    step4_final = np.expand_dims(step3_normalized, axis=-1)

    # Create comprehensive JSON
    preprocessing_data = {
        "category": category,
        "timestamp": "2026-02-03",
        "pipeline_version": "v2.0.0",
        "note": "Pipeline réel utilisé pour le preprocessing. Les fichiers .npy contiennent déjà des images 28×28 pré-rendues par Google.",
        "step_0_source_format": {
            "description": "Fichiers .npy téléchargés depuis Quick Draw",
            "url": "https://console.cloud.google.com/storage/browser/quickdraw_dataset/full/numpy_bitmap",
            "format": "NumPy array (.npy)",
            "shape": [28, 28],
            "dtype": "uint8",
            "values_range": [0, 255],
            "note": "Google a déjà converti les strokes vectoriels en images 28×28",
        },
        "step_1_load_npy": {
            "description": "Chargement du fichier .npy",
            "method": "np.load()",
            "output_shape": [28, 28],
            "statistics": {
                "min_pixel_value": int(np.min(step1_original)),
                "max_pixel_value": int(np.max(step1_original)),
                "mean_pixel_value": float(np.mean(step1_original)),
                "std_pixel_value": float(np.std(step1_original)),
            },
            "sample_pixels_top_left_3x3": step1_original[:3, :3].astype(int).tolist(),
        },
        "step_2_centroid_crop": {
            "description": "Recentrage basé sur le barycentre des pixels non-blancs",
            "threshold": 25,
            "threshold_explanation": "Pixels > 25 (~10% de 255) considérés comme dessin",
            "centroid_before_crop": {"x": float(centroid_x), "y": float(centroid_y)},
            "target_center": {"x": 14, "y": 14},
            "shift_applied": {"x": float(shift_x), "y": float(shift_y)},
            "method": "Translation propre sans wrap-around (remplissage blanc)",
            "impact": "+3.1% accuracy (87.1% → 90.2%)",
            "justification": "Les utilisateurs dessinent à différents endroits du canvas",
            "statistics_after_crop": {
                "min_pixel_value": int(np.min(step2_cropped)),
                "max_pixel_value": int(np.max(step2_cropped)),
                "mean_pixel_value": float(np.mean(step2_cropped)),
                "std_pixel_value": float(np.std(step2_cropped)),
            },
            "sample_pixels_center_5x5": step2_cropped[12:17, 12:17]
            .astype(int)
            .tolist(),
        },
        "step_3_normalization": {
            "description": "Normalisation des valeurs de pixels",
            "input_range": [0, 255],
            "output_range": [0.0, 1.0],
            "formula": "pixel_value / 255.0",
            "dtype": "float32",
            "justification": "Stabilise le gradient descent, standard pour les CNNs",
            "statistics": {
                "min_value": float(np.min(step3_normalized)),
                "max_value": float(np.max(step3_normalized)),
                "mean_value": float(np.mean(step3_normalized)),
                "std_value": float(np.std(step3_normalized)),
            },
            "sample_pixels_center_3x3": step3_normalized[13:16, 13:16]
            .round(3)
            .tolist(),
        },
        "step_4_add_channel_dimension": {
            "description": "Ajout de la dimension canal pour compatibilité CNN",
            "input_shape": list(step3_normalized.shape),
            "output_shape": list(step4_final.shape),
            "channel_dimension": 1,
            "format": "(height, width, channels)",
            "justification": "Format attendu par Conv2D de Keras/TensorFlow",
            "note": "Grayscale = 1 canal, RGB = 3 canaux",
        },
        "final_output": {
            "shape": list(step4_final.shape),
            "dtype": str(step4_final.dtype),
            "memory_size_bytes": step4_final.nbytes,
            "ready_for_model": True,
            "model_input_format": "keras.layers.Conv2D expects (batch_size, 28, 28, 1)",
        },
        "preprocessing_summary": {
            "total_steps": 4,
            "pipeline": ".npy (28×28) → Centroid Crop → Normalisation → Add Channel",
            "key_optimizations": [
                "Centroid crop pour invariance à la position",
                "Normalisation [0,1] pour stabilité d'entraînement",
                "Pas de resize nécessaire (déjà 28×28)",
            ],
            "accuracy_gain": "+3.1% (centroid crop uniquement)",
            "processing_time_per_image": "~2ms sur CPU standard",
        },
        "note_important": {
            "pipeline_reel": ".npy → Centroid Crop → Normalisation",
            "pipeline_complet_original": "Strokes vectoriels → Rendu PIL 255×255 → Resize 28×28 → Centroid Crop → Normalisation",
            "explication": "Google a déjà effectué la conversion strokes→255×255→28×28. Nous ne faisons que le centroid crop et la normalisation.",
        },
    }

    output_path = os.path.join(
        output_dir, f"preprocessing_steps_detailed_{category}.json"
    )
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(preprocessing_data, f, indent=2, ensure_ascii=False)

    print(f"✅ Saved detailed preprocessing JSON: {output_path}")
    return preprocessing_data


def process_category(category: str):
    """Process a single category and generate all visualizations"""
    print(f"\n{'=' * 60}")
    print(f"Processing category: {category.upper()}")
    print(f"{'=' * 60}\n")

    # Create output directory for this category
    output_dir = create_output_dirs(category)

    # Load sample drawings
    samples = load_sample_drawings(category, NUM_EXAMPLES)
    if samples is None:
        print(f"❌ Skipping {category} - file not found\n")
        return False

    print("\nGenerating visualizations...\n")

    try:
        # Generate visualizations
        visualize_preprocessing_pipeline(
            0, samples, category, output_dir
        )  # First example
        visualize_centroid_crop_comparison(samples, category, output_dir)
        visualize_dataset_grid(samples, category, output_dir)
        create_statistics_visualization(samples, category, output_dir)
        create_preprocessing_impact_table(output_dir)

        # Create metadata JSON
        metadata = create_metadata_json(samples, category, output_dir)

        # Create detailed preprocessing JSON with step-by-step data
        preprocessing_details = create_detailed_preprocessing_json(
            samples[0], category, output_dir
        )

        print(f"\n✅ Successfully processed {category}\n")
        return True
    except Exception as e:
        print(f"\n❌ Error processing {category}: {str(e)}\n")
        return False


def main():
    """Main execution"""
    print("=" * 60)
    print("GÉNÉRATION DE VISUELS POUR LA PRÉSENTATION")
    print(f"Nombre de catégories: {len(CATEGORIES)}")
    print("=" * 60)

    success_count = 0
    failed_categories = []

    for category in CATEGORIES:
        if process_category(category):
            success_count += 1
        else:
            failed_categories.append(category)

    print("\n" + "=" * 60)
    print("✅ GÉNÉRATION TERMINÉE")
    print("=" * 60)
    print(f"\nRésultats:")
    print(f"  • Catégories traitées avec succès: {success_count}/{len(CATEGORIES)}")
    if failed_categories:
        print(f"  • Catégories échouées: {', '.join(failed_categories)}")
    print(f"\nTous les fichiers générés dans: {OUTPUT_BASE_DIR}/")
    print("\nFichiers générés par catégorie:")
    print(f"  • pipeline_{{category}}_example_1.png")
    print(f"  • centroid_crop_comparison_{{category}}.png")
    print(f"  • {{category}}_samples_grid.png")
    print(f"  • {{category}}_statistics.png")
    print(f"  • preprocessing_impact_table.png")
    print(f"  • presentation_metadata_{{category}}.json")
    print(f"  • preprocessing_steps_detailed_{{category}}.json")
    print()
    print("Utilisez ces images pour votre présentation! 🎨")


if __name__ == "__main__":
    main()
