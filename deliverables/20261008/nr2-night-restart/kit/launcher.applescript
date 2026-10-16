-- Scintilla Night Reload - the launcher. This small app is the ONE thing Alan allows in System Settings > Privacy & Security >
-- Accessibility. It does nothing by itself except start night-reload.sh and show the one line that script may leave for Alan.
--
-- How it is started decides what it does:
--   double-click, or no instruction        dry run: looks, sends nothing, shows what it saw
--   SCINTILLA_NIGHT_RELOAD_MODE=test       the real thing now, for a supervised test
--   SCINTILLA_NIGHT_RELOAD_MODE=run        the nightly job (only the timetable starts it this way, through /usr/bin/open)
-- Built on each Mac by install.sh (osacompile), so the permission belongs to that Mac's own copy. Rebuilding it makes macOS ask again.
-- (16 Oct 2026: the iMac's copy is the 7 Oct build and is NOT rebuilt for the change below; the job itself no longer prints a NOTE line
-- at night, so that copy shows no box at night either. The change here is for the next Mac, or the next rebuild.)

on run
	set mode to "dry-run"
	try
		set m to system attribute "SCINTILLA_NIGHT_RELOAD_MODE"
		if m is "run" or m is "test" or m is "dry-run" then set mode to m
	end try
	set kit to (system attribute "HOME") & "/Scintilla/night-reload"
	try
		set k to system attribute "SCINTILLA_NIGHT_RELOAD_KIT"
		if k is not "" then set kit to k
	end try
	set outText to ""
	try
		set outText to do shell script "/bin/bash " & quoted form of (kit & "/night-reload.sh") & " " & quoted form of mode & " 2>&1"
	on error errText
		set outText to "NOTE" & tab & "Night reload could not start: " & errText
	end try
	-- a line that begins NOTE<tab> is for Alan. 16 Oct 2026: a box that waits for a click keeps this app alive, and while it is alive
	-- macOS refuses every later start ("was already running") - the 04:26 box blocked the 04:30 try. So no box waits for long: the
	-- nightly job posts a notification (the note itself is in LAST-NIGHT.txt), and the boxes of a test or a dry run give up after a
	-- minute. No default button on the note: a stray Return while he is typing does not dismiss it unread.
	set noteText to ""
	repeat with ln in paragraphs of outText
		try
			if (ln as text) starts with ("NOTE" & tab) then set noteText to text 6 thru -1 of (ln as text)
		end try
	end repeat
	try
		if noteText is not "" and mode is "run" then
			display notification noteText with title "Scintilla night reload"
		else if noteText is not "" then
			tell me to activate
			display dialog noteText with title "Scintilla night reload" buttons {"OK"} with icon note giving up after 60
		else if mode is not "run" then
			tell me to activate
			display dialog my lastLines(outText, 9) with title "Scintilla night reload - " & mode buttons {"OK"} default button 1 giving up after 60
		end if
	end try
end run

-- 8 Oct 2026: with the restart the record of a test is some sixty lines, a dialog cannot scroll, and the screen that shows the
-- Station is small. So the box shows the END of the record - the result and each app's memory before and after - and says where
-- the whole of it is.
on lastLines(t, n)
	set kept to {}
	repeat with p in paragraphs of t
		if (p as text) is not "" then set end of kept to (p as text)
	end repeat
	if (count of kept) is less than or equal to n then return t
	set out to "(the end of the record; all of it is in ~/Library/Logs/scintilla-night-reload.log)" & linefeed
	repeat with i from ((count of kept) - n + 1) to (count of kept)
		set out to out & linefeed & (item i of kept)
	end repeat
	return out
end lastLines
