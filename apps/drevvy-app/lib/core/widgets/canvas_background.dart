import 'package:flutter/material.dart';
import '../theme/drevvy_theme.dart';

/// Soft gradient blob background per Halo spec.
class CanvasBackground extends StatelessWidget {
  const CanvasBackground({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final size = MediaQuery.of(context).size;

    return SizedBox.expand(
      child: DecoratedBox(
        decoration: BoxDecoration(color: colors.canvas),
        child: Stack(
          children: [
            // Top-right violet blob
            Positioned(
              top: -size.height * 0.1,
              right: -size.width * 0.2,
              child: Container(
                width: size.width * 0.8,
                height: size.width * 0.8,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      colors.blobs[0],
                      colors.blobs[0].withValues(alpha: 0),
                    ],
                  ),
                ),
              ),
            ),
            // Left blue blob
            Positioned(
              top: size.height * 0.3,
              left: -size.width * 0.3,
              child: Container(
                width: size.width * 0.7,
                height: size.width * 0.7,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      colors.blobs[1],
                      colors.blobs[1].withValues(alpha: 0),
                    ],
                  ),
                ),
              ),
            ),
            // Bottom-right lilac blob
            Positioned(
              bottom: size.height * 0.1,
              right: -size.width * 0.1,
              child: Container(
                width: size.width * 0.6,
                height: size.width * 0.6,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      colors.blobs[2],
                      colors.blobs[2].withValues(alpha: 0),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
