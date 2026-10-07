-- gui.applescript - the only file that touches windows. It talks to macOS's own "System Events", never to Brave, Chrome or X directly.
--
--   osascript gui.applescript trusted                 true | false      is 'Scintilla Night Reload' allowed in Accessibility?
--   osascript gui.applescript front                   bundle id of the app in front
--   osascript gui.applescript windows <bundle id>     one line per ordinary window: title <tab> min|open
--   osascript gui.applescript find-reload <bundle id> found:<menu> > <item>:enabled|disabled | none     (looks only)
--   osascript gui.applescript activate <bundle id>    ok | not-front    brings that ONE app to the front and checks that it is
--   osascript gui.applescript raise <bundle id> <n>   ok | skipped:minimised   brings that app's n-th window to the top of its own windows
--   osascript gui.applescript reload <bundle id>      ok:menu | ok:key | refused:<why>
--   osascript gui.applescript shortcut <bundle id>    sent | refused:<why>   Option+Shift+S, the X extension's shortcut
--
-- TWO RULES THAT LIVE HERE AND NOWHERE ELSE:
--   - "reload" presses that app's own menu item (the one whose shortcut is Command-R), found by its shortcut so the menu's wording and
--     language do not matter. A menu item belongs to one app, so it cannot land in another window. Only if the app has no such item does
--     it type Command-R, and then only after the check below.
--   - a key is typed ONLY when the app in front, read at that very moment, is the app asked for and it has an ordinary window that is
--     not minimised. Otherwise nothing is typed and the answer is "refused". Option+Shift+S typed into the wrong app would put a
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
			tell application "System Events"
				set procs to (application processes whose bundle identifier is bid)
				if (count of procs) is 0 then return "no-process"
				set p to item 1 of procs
			end tell
			if verb is "windows" then
				return my listWindows(p)
			else if verb is "find-reload" then
				set mi to my findReload(p)
				if mi is missing value then return "none"
				return my describeItem(mi)
			else if verb is "activate" then
				return my bringToFront(p)
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
					tell application "System Events"
						if enabled of mi then
							click mi
							return "ok:menu"
						end if
					end tell
					return "refused:the reload menu item is switched off"
				end if
				-- no such menu item in this app: type Command-R, re-checking who is in front at this very moment
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
		if (count of ws) is 0 then return "it has no window"
		try
			if (value of attribute "AXMinimized" of (item 1 of ws)) is true then return "its window is minimised"
		end try
	end tell
	return ""
end notReady

on bringToFront(p)
	tell application "System Events"
		set frontmost of p to true
		repeat 20 times
			if frontmost of p then return "ok"
			delay 0.15
		end repeat
	end tell
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
