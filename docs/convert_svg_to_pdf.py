#!/usr/bin/env python3
"""Convert SVG files to PNG"""

import cairosvg
import os

# Chemin vers les fichiers
docs_dir = os.path.dirname(os.path.abspath(__file__))

# Conversion architecture-production.svg
input_svg1 = os.path.join(docs_dir, "architecture-production.svg")
output_png1 = os.path.join(docs_dir, "architecture-production.png")

print(f"Converting {input_svg1} to PNG...")
cairosvg.svg2png(url=input_svg1, write_to=output_png1, scale=2.0)
print(f"✓ Created: {output_png1}")

# Conversion cnn-architecture.svg
input_svg2 = os.path.join(docs_dir, "cnn-architecture.svg")
output_png2 = os.path.join(docs_dir, "cnn-architecture.png")

print(f"\nConverting {input_svg2} to PNG...")
cairosvg.svg2png(url=input_svg2, write_to=output_png2, scale=2.0)
print(f"✓ Created: {output_png2}")

print("\n✅ Conversion terminée!")
