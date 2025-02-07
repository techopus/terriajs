import React, { FC, useState, useRef, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";

import Terria from "../../../../Models/Terria";
import ViewState from "../../../../ReactViewModels/ViewState";

import Box from "../../../../Styled/Box";
import Spacing from "../../../../Styled/Spacing";
import Text from "../../../../Styled/Text";

import { ShareUrl, IShareUrlRef, ShareUrlBookmark } from "./ShareUrl";
import { canShorten } from "./BuildShareLink";
import { AdvancedOptions } from "./AdvancedOptions";
import { StyledHr } from "./StyledHr";
import { PrintSection } from "./Print/PrintSection";
import { useCallbackRef } from "../../../useCallbackRef";

interface ISharePanelContentProps {
  terria: Terria;
  viewState: ViewState;
  closePanel: () => void;
}

export const SharePanelContent: FC<ISharePanelContentProps> = ({
  terria,
  viewState,
  closePanel
}) => {
  const { t } = useTranslation();
  const canShortenUrl = useMemo(() => !!canShorten(terria), [terria]);

  const [includeStoryInShare, setIncludeStoryInShare] = useState(true);
  const [shouldShorten, setShouldShorten] = useState(canShortenUrl);

  const [_, update] = useState<{}>();
  const shareUrlRef = useCallbackRef<IShareUrlRef>(null, () => update({}));

  const includeStoryInShareOnChange = useCallback(() => {
    setIncludeStoryInShare(prevState => !prevState);
  }, []);

  const shouldShortenOnChange = useCallback(() => {
    setShouldShorten(prevState => {
      terria.setLocalProperty("shortenShareUrls", prevState);
      return !prevState;
    });
  }, [terria]);

  return (
    <Box paddedRatio={2} column>
      <Text medium>{t("clipboard.shareURL")}</Text>
      <Spacing bottom={1} />
      <ShareUrl
        theme="dark"
        inputTheme="dark"
        terria={terria}
        viewState={viewState}
        includeStories={includeStoryInShare}
        shouldShorten={shouldShorten}
        ref={shareUrlRef}
        callback={closePanel}
      >
        <ShareUrlBookmark viewState={viewState} />
      </ShareUrl>
      <Spacing bottom={2} />
      <PrintSection viewState={viewState} />
      <StyledHr />
      <AdvancedOptions
        canShortenUrl={canShortenUrl}
        shouldShorten={shouldShorten}
        shouldShortenOnChange={shouldShortenOnChange}
        includeStoryInShare={includeStoryInShare}
        includeStoryInShareOnChange={includeStoryInShareOnChange}
        shareUrl={shareUrlRef}
      />
    </Box>
  );
};
