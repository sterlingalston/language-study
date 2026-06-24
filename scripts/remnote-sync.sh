#!/bin/bash
# Trigger RemNote vocabulary sync via the browser plugin.
# Finds the Chrome window on display :1, navigates to RemNote if needed,
# then fires the sync command via the command palette.

DISPLAY_ENV=":1"
REMNOTE_URL="https://www.remnote.com/home"

# Find Chrome window
WID=$(DISPLAY=$DISPLAY_ENV xdotool search --name "Google Chrome" 2>/dev/null | head -1)

if [ -z "$WID" ]; then
  echo "$(date): Chrome not found on display $DISPLAY_ENV — skipping RemNote sync" >&2
  exit 1
fi

CURRENT=$(DISPLAY=$DISPLAY_ENV xdotool getwindowname "$WID" 2>/dev/null)
echo "$(date): Chrome window found: $CURRENT"

# Navigate to RemNote if not already there
if ! echo "$CURRENT" | grep -qi "remnote"; then
  echo "$(date): Navigating to RemNote..."
  DISPLAY=$DISPLAY_ENV xdotool windowfocus "$WID"
  DISPLAY=$DISPLAY_ENV xdotool key --window "$WID" ctrl+l
  sleep 0.5
  DISPLAY=$DISPLAY_ENV xdotool type --window "$WID" "$REMNOTE_URL"
  DISPLAY=$DISPLAY_ENV xdotool key --window "$WID" Return
  sleep 12  # wait for RemNote to load and plugin to activate
fi

# Open command palette and run sync
echo "$(date): Triggering sync command..."
DISPLAY=$DISPLAY_ENV xdotool windowfocus "$WID"
DISPLAY=$DISPLAY_ENV xdotool key --window "$WID" ctrl+p
sleep 2
DISPLAY=$DISPLAY_ENV xdotool type --window "$WID" "Sync Language Vocabulary"
sleep 1
DISPLAY=$DISPLAY_ENV xdotool key --window "$WID" Return

echo "$(date): Sync command sent."
