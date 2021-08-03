import i18next, { i18n } from "i18next";
import {
  TRANSLATE_KEY_PREFIX,
  useTranslationIfExists
} from "../../lib/Language/languageHelpers";

describe("useTranslationIfExists", function() {
  let i18n: i18n;
  const translationKey = "testKey";

  beforeEach(async function() {
    i18n = i18next.createInstance({
      lng: "spec",
      debug: false,
      resources: {
        spec: {
          translation: {
            [translationKey]: "testString"
          }
        }
      }
    });
    await i18n.init();
  });

  it("returns an unprefixed string without changing it", function() {
    expect(useTranslationIfExists(translationKey, i18n)).toBe(translationKey);
  });

  it("returns a translation of a prefixed string", function() {
    expect(
      useTranslationIfExists(TRANSLATE_KEY_PREFIX + translationKey, i18n)
    ).toBe("testString");
  });
});
