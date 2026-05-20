/**
 * Calculates the width and height of a seed contour using Principal Component Analysis (PCA).
 * This ensures the seed is measured as if it were always lying horizontally (flat).
 * Matches the PCA calculation logic in orchid-seed-analyzer.py.
 */
export function calculateSeedDimensions(polygonPoints: [number, number][]): { width: number; height: number } {
  if (!polygonPoints || polygonPoints.length < 3) {
    return { width: 0, height: 0 };
  }

  try {
    const N = polygonPoints.length;

    // 1. Calculate centroid (mean)
    let sumX = 0;
    let sumY = 0;
    for (const [x, y] of polygonPoints) {
      sumX += x;
      sumY += y;
    }
    const meanX = sumX / N;
    const meanY = sumY / N;

    // 2. Center the points
    const centered = polygonPoints.map(([x, y]) => [x - meanX, y - meanY] as [number, number]);

    // 3. Compute covariance matrix
    // covXX = sum(x_i^2) / (N - 1)
    // covYY = sum(y_i^2) / (N - 1)
    // covXY = sum(x_i * y_i) / (N - 1)
    let covXX = 0;
    let covYY = 0;
    let covXY = 0;

    for (const [cx, cy] of centered) {
      covXX += cx * cx;
      covYY += cy * cy;
      covXY += cx * cy;
    }

    // Bessel's correction for sample covariance
    const divisor = N > 1 ? N - 1 : 1;
    covXX /= divisor;
    covYY /= divisor;
    covXY /= divisor;

    // 4. Calculate eigenvalues & eigenvectors of the symmetric 2x2 covariance matrix
    // The matrix is:
    // [ covXX  covXY ]
    // [ covXY  covYY ]
    // Trace T = covXX + covYY
    // Determinant D = covXX*covYY - covXY*covXY
    const T = covXX + covYY;
    const D = covXX * covYY - covXY * covXY;

    // Characteristic equation: lambda^2 - T*lambda + D = 0
    // Root formula: lambda = T/2 +/- sqrt(T^2/4 - D)
    const term = T * T / 4 - D;
    const sqrtTerm = Math.sqrt(Math.max(0, term));
    const lambda1 = T / 2 + sqrtTerm;
    const lambda2 = T / 2 - sqrtTerm;

    let v1: [number, number] = [1, 0];
    let v2: [number, number] = [0, 1];

    if (Math.abs(covXY) > 1e-9) {
      // For lambda1, eigenvector v1 is [lambda1 - covYY, covXY]
      const rawV1X = lambda1 - covYY;
      const rawV1Y = covXY;
      const mag1 = Math.sqrt(rawV1X * rawV1X + rawV1Y * rawV1Y);
      if (mag1 > 1e-9) {
        v1 = [rawV1X / mag1, rawV1Y / mag1];
      }

      // For lambda2, eigenvector v2 is [lambda2 - covYY, covXY]
      const rawV2X = lambda2 - covYY;
      const rawV2Y = covXY;
      const mag2 = Math.sqrt(rawV2X * rawV2X + rawV2Y * rawV2Y);
      if (mag2 > 1e-9) {
        v2 = [rawV2X / mag2, rawV2Y / mag2];
      }
    } else {
      // If covXY is near zero, the covariance matrix is already diagonal
      // Eigenvectors are the standard axes
      if (covXX >= covYY) {
        v1 = [1, 0];
        v2 = [0, 1];
      } else {
        v1 = [0, 1];
        v2 = [1, 0];
      }
    }

    // 5. Rotate points to the principal axes coordinate system (projection)
    let minP1 = Infinity;
    let maxP1 = -Infinity;
    let minP2 = Infinity;
    let maxP2 = -Infinity;

    for (const [cx, cy] of centered) {
      const p1 = cx * v1[0] + cy * v1[1];
      const p2 = cx * v2[0] + cy * v2[1];

      if (p1 < minP1) minP1 = p1;
      if (p1 > maxP1) maxP1 = p1;
      if (p2 < minP2) minP2 = p2;
      if (p2 > maxP2) maxP2 = p2;
    }

    const dim1 = maxP1 - minP1;
    const dim2 = maxP2 - minP2;

    // 6. Ensure width is always the larger dimension (seed horizontal)
    const width = Math.max(dim1, dim2);
    const height = Math.min(dim1, dim2);

    return {
      width: parseFloat(width.toFixed(2)),
      height: parseFloat(height.toFixed(2))
    };
  } catch (error) {
    // Fallback to axis-aligned bounding box (AABB) in case of mathematical instability
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const [x, y] of polygonPoints) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }

    const dim1 = maxX - minX;
    const dim2 = maxY - minY;

    const width = Math.max(dim1, dim2);
    const height = Math.min(dim1, dim2);

    return {
      width: parseFloat(width.toFixed(2)),
      height: parseFloat(height.toFixed(2))
    };
  }
}
