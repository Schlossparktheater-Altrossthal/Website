"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DismissibleNotice, deviceNoticeStorageKey } from "@/components/ui/dismissible-notice";
import { ShareIcon, SmartphoneIcon } from "@/components/ui/action-icons";
import { usePwaInstall } from "@/lib/pwa/register-sw";

const NOTICE_KEY = "install-app";

function readDismissed() {
  try {
    return Boolean(window.localStorage.getItem(deviceNoticeStorageKey(NOTICE_KEY)));
  } catch {
    return false;
  }
}

/**
 * Hinweis „Als App installieren“. Die Installation gilt pro Gerät, daher wird der Hinweis auch
 * nur auf diesem Gerät ausgeblendet. iOS kennt keinen Installationsdialog – dort eine Anleitung.
 */
export function InstallAppNotice({ className }: { className?: string }) {
  const { standalone, canPrompt, iosManual, promptInstall } = usePwaInstall();
  const [dismissed, setDismissed] = React.useState(true);
  const [showSteps, setShowSteps] = React.useState(false);

  React.useEffect(() => {
    // localStorage gibt es erst im Browser; bis dahin bleibt der Hinweis verborgen.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(readDismissed());
  }, []);

  if (dismissed || standalone || (!canPrompt && !iosManual)) return null;

  const install = async () => {
    const outcome = await promptInstall();
    if (outcome === "dismissed") toast.info("Installation abgebrochen", { duration: 2000 });
  };

  return (
    <DismissibleNotice
      noticeKey={NOTICE_KEY}
      scope="device"
      tone="primary"
      icon={<SmartphoneIcon />}
      title="Als App installieren"
      description={
        iosManual ? (
          showSteps ? (
            <>
              Unten auf <ShareIcon className="inline h-3.5 w-3.5 align-text-bottom" /> „Teilen“
              tippen, dann „Zum Home-Bildschirm“. Danach sind auch Push-Benachrichtigungen möglich.
            </>
          ) : (
            "Schneller Zugriff vom Home-Bildschirm – und Push-Benachrichtigungen."
          )
        ) : (
          "Schneller Zugriff vom Home-Bildschirm oder Startmenü."
        )
      }
      action={
        iosManual ? (
          showSteps ? null : (
            <Button size="sm" variant="outline" onClick={() => setShowSteps(true)}>
              So geht&apos;s
            </Button>
          )
        ) : (
          <Button size="sm" onClick={() => void install()}>
            Installieren
          </Button>
        )
      }
      onDismissed={() => setDismissed(true)}
      className={className}
    />
  );
}
