-- gui.applescript - the only file that touches windows. It talks to macOS's own "System Events", never to Brave, Chrome or X directly.
--
--   osascript gui.applescript trusted                 true | false      is 'Scintilla Night Reload' allowed in Accessibility?
--   osascript gui.applescript front                   bundle id of the app in front
--   osascript gui.applescript windows <bundle id>     one line per ordinary window: title <tab> min|open
--   osascript gui.applescript find-reload <bundle id> found:<menu> > <item>:enabled|disabled | none     (looks only)
--   osascript gui.applescript activate <bundle id>    ok | not-front    brings that ONE app to the front (open -b) and reads back that it is
--   osascript gui.applescript raise <bundle id> <n>   ok | skipped:minimised   brings that app's n-th window to the top of its own windows
--   osascript gui.applescript reload <bundle id>      ok:menu | ok:key | refused:<why>
--   osascript gui.applescript shortcut <bundle id>    sent | refused:<why>   Option+Shift+S, the X extension's shortcut
--
-- 15 Oct 2026 - the windows wherever they are (Alan: "The station has no open window ... I mean, it was open"):
--   osascript gui.applescript everywhere <bundle id>  one line per window the WINDOW SERVER knows, on every desktop (windows.js):
--                                                     on|off <tab> full|normal <tab> <w>x<h>   | none | no-process     (looks only)
--   osascript gui.applescript unminimise <bundle id>  ok:<n> | none      brings that app's minimised windows back from the Dock
--   osascript gui.applescript consent <bundle id>     allowed | denied | not-asked | not-running   may this launcher send Apple events
--                                                     to that app? Read without asking (consent.js); the dialog never comes from this.
--   osascript gui.applescript ask-consent <bundle id> the ONE click: makes macOS show its Automation dialog for that app, once.
--                                                     Only the coordinator runs this, with Alan. Answers allowed | denied | not-asked.
--   osascript gui.applescript tabs <bundle id>        Brave's own windows and tabs (brave-tabs.js) - ONLY when consent says allowed;
--                                                     otherwise "refused:no consent" and nothing is asked of Brave
--   osascript gui.applescript active-tab <bundle id> <window n> <tab n>   ok | refused:no consent | error:...
-- TWO RULES THAT LIVE HERE AND NOWHERE ELSE:
--   - "reload" presses that app's own menu item (the one whose shortcut is Command-R), found by its shortcut so the menu's wording and
--     language do not matter. A menu item belongs to one app, so it cannot land in another window. Only if the app has no such item does
--     it type Command-R, and then only after the check below.
--   - a key is typed ONLY when the app in front, read at that very moment, is the app asked for and it has an ordinary window that is
--     not minimised - or, when Accessibility lists no ordinary window at all, the window server shows one of its windows on the
--     desktop in front (that is a window in native full screen: Accessibility does not list it, keys still reach it).
--     Otherwise nothing is typed and the answer is "refused". Option+Shift+S typed into the wrong app would put a
--     character into whatever Alan left open; typed into the wrong browser window it would make the extension open a new X tab.
--
-- Every answer is one line. Anything that is not the expected word means "do not go on" to night-reload.sh.

on run argv
	if (count of argv) is 0 then return "error:no verb"
	set verb to item 1 of argv
	set bid to ""
	if (count of argv) > 1 then set bid to item 2 of argv
	try
		with timeout of 30 seconds
			if verb is "trusted" then
				tell application "System Events" to return (UI elements enabled) as text
			else if verb is "front" then
				tell application "System Events" to return (bundle identifier of (first application process whose frontmost is true)) as text
			end if
			if bid is "" then return "error:no app named"
			if verb is "consent" then
				return my helper("consent.js", quoted form of bid)
			else if verb is "ask-consent" then
				-- the one click. Any Apple event to an app macOS has not decided about makes it show its dialog; "count windows"
				-- changes nothing in that app.
				try
					tell application id bid to count windows
				end try
				return my helper("consent.js", quoted form of bid)
			else if verb is "tabs" then
				if my helper("consent.js", quoted form of bid) is not "allowed" then return "refused:no consent"
				return my helper("brave-tabs.js", quoted form of bid & " list")
			else if verb is "active-tab" then
				if (count of argv) < 4 then return "error:window and tab numbers needed"
				if my helper("consent.js", quoted form of bid) is not "allowed" then return "refused:no consent"
				return my helper("brave-tabs.js", quoted form of bid & " active " & quoted form of (item 3 of argv) & " " & quoted form of (item 4 of argv))
			end if
			tell application "System Events"
				set procs to (application processes whose bundle identifier is bid)
				if (count of procs) is 0 then return "no-process"
				set p to item 1 of procs
			end tell
			if verb is "windows" then
				return my listWindows(p)
			else if verb is "everywhere" then
				set pidText to ""
				tell application "System Events" to set pidText to (unix id of p) as text
				set rows to my helper("windows.js", pidText)
				if rows is "" then return "none"
				return rows
			else if verb is "unminimise" then
				set n to 0
				tell application "System Events"
					repeat with w in (windows of p whose subrole is "AXStandardWindow")
						try
							if (value of attribute "AXMinimized" of w) is true then
								set value of attribute "AXMinimized" of w to false
								set n to n + 1
							end if
						end try
					end repeat
				end tell
				if n is 0 then return "none"
				return "ok:" & n
			else if verb is "find-reload" then
				set mi to my findReload(p)
				if mi is missing value then return "none"
				return my describeItem(mi)
			else if verb is "activate" then
				return my bringToFront(p, bid)
			else if verb is "raise" then
				if (count of argv) < 3 then return "error:no window number"
				set n to (item 3 of argv) as integer
				tell application "System Events"
					set ws to (windows of p whose subrole is "AXStandardWindow")
					if n > (count of ws) then return "error:no such window"
					try
						if (value of attribute "AXMinimized" of (item n of ws)) is true then return "skipped:minimised"
					end try
					perform action "AXRaise" of (item n of ws)
				end tell
				return "ok"
			else if verb is "reload" then
				set why to my notReady(p, bid)
				if why is not "" then return "refused:" & why
				set mi to my findReload(p)
				if mi is not missing value then
					set canClick to false
					tell application "System Events"
						try
							set canClick to (enabled of mi)
						end try
						if canClick then
							click mi
							return "ok:menu"
						end if
					end tell
				end if
				-- no usable menu item: type Command-R, re-checking who is in front at this very moment. (12 Oct 2026, measured on the iMac:
				-- Brave web apps report "Reload This Page" as switched off even for the app in front, so the item alone must not stop a reload.)
				set why to my notReady(p, bid)
				if why is not "" then return "refused:" & why
				tell application "System Events" to keystroke "r" using {command down}
				return "ok:key"
			else if verb is "shortcut" then
				set why to my notReady(p, bid)
				if why is not "" then return "refused:" & why
				tell application "System Events" to keystroke "s" using {option down, shift down}
				return "sent"
			end if
		end timeout
		return "error:unknown verb"
	on error errText number errNum
		return "error:" & errNum & " " & errText
	end try
end run

-- "" when the app asked for is the one in front right now and has an ordinary window that is not minimised; otherwise the reason
on notReady(p, bid)
	tell application "System Events"
		set frontBid to (bundle identifier of (first application process whose frontmost is true)) as text
		if frontBid is not bid then return "another app is in front (" & frontBid & ")"
		set ws to (windows of p whose subrole is "AXStandardWindow")
		if (count of ws) is 0 then
			-- Accessibility lists nothing: a window in native full screen is like that. The window server says whether one of this
			-- app's windows is on the desktop in front; if so the app in front has a window on screen and a key reaches it.
			set pidText to (unix id of p) as text
			if my onScreenCount(pidText) is greater than 0 then return ""
			return "it has no window"
		end if
		try
			if (value of attribute "AXMinimized" of (item 1 of ws)) is true then return "its window is minimised"
		end try
	end tell
	return ""
end notReady

-- the small JavaScript helpers beside this file (windows.js, consent.js, brave-tabs.js); "" when one fails
on helper(fileName, args)
	set kitDir to do shell script "dirname " & quoted form of (POSIX path of (path to me))
	try
		return do shell script "/usr/bin/osascript -l JavaScript " & quoted form of (kitDir & "/" & fileName) & " " & args
	on error
		return ""
	end try
end helper

on onScreenCount(pidText)
	set n to 0
	repeat with ln in paragraphs of my helper("windows.js", pidText)
		if (ln as text) starts with "on" then set n to n + 1
	end repeat
	return n
end onScreenCount

on bringToFront(p, bid)
	-- 12 Oct 2026, measured on the iMac: for a Brave web app, System Events "set frontmost" answers true while the OTHER web app stays in
	-- front, so the Station was never really brought forward and its reload was refused. Launch Services brings the right one forward;
	-- the app really in front is then read back and must be the one asked for on two reads in a row before the answer is ok.
	try
		do shell script "/usr/bin/open -b " & quoted form of bid
	end try
	set steady to 0
	repeat 30 times
		tell application "System Events" to set frontBid to (bundle identifier of (first application process whose frontmost is true)) as text
		if frontBid is bid then
			set steady to steady + 1
			if steady is greater than or equal to 2 then return "ok"
		else
			set steady to 0
		end if
		delay 0.2
	end repeat
	return "not-front"
end bringToFront

on listWindows(p)
	set out to ""
	tell application "System Events"
		repeat with w in (windows of p whose subrole is "AXStandardWindow")
			set t to ""
			try
				set t to (name of w) as text
			end try
			set m to "open"
			try
				if (value of attribute "AXMinimized" of w) is true then set m to "min"
			end try
			set out to out & t & tab & m & linefeed
		end repeat
	end tell
	return out
end listWindows

-- the menu item whose shortcut is Command-R with no other modifier, wherever the app keeps it and whatever it is called
on findReload(p)
	tell application "System Events"
		repeat with mbi in (menu bar items of menu bar 1 of p)
			try
				repeat with mi in (menu items of menu 1 of mbi)
					try
						if (value of attribute "AXMenuItemCmdChar" of mi) is "R" then
							if (value of attribute "AXMenuItemCmdModifiers" of mi) is 0 then return (contents of mi)
						end if
					end try
				end repeat
			end try
		end repeat
	end tell
	return missing value
end findReload

on describeItem(mi)
	tell application "System Events"
		set s to "found:"
		try
			set s to s & (name of mi)
		end try
		if enabled of mi then return s & ":enabled"
		return s & ":disabled"
	end tell
end describeItem
