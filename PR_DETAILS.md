### Title
🧪 [Testing Improvement] Add comprehensive tests for `referenceToUmPerPixel` in calibration library

### Description

* 🎯 **What:** The `referenceToUmPerPixel` function in `src/lib/calibration.ts` was untested. This is a critical pure function that calculates the micrometer per pixel scale using a known reference length measured on the image. Since accurate calibrations are crucial for ensuring the rest of the morphometry processes work correctly, this testing gap needed to be addressed.
* 📊 **Coverage:** Tests were added to cover the following scenarios:
    * **Standard calculations across all supported units:** Verified correct conversions for millimeters (`mm`), micrometers (`um`), centimeters (`cm`), and inches (`in`).
    * **Error handling / Edge cases:** Ensure the function safely returns `0` when `pixels` is zero or negative.
    * **Invalid inputs:** Ensure the function safely returns `0` when `length` is zero or negative.
    * **Floating-point results:** Proper handling and rounding of expected decimal values (using `toBeCloseTo`).
* ✨ **Result:** We now have deterministic unit tests verifying the correctness of the core calibration math across all units. This builds a reliable safety net for future refactors and guarantees no regressions are introduced in the measurement logic.
