#!/usr/bin/perl
# brave-session.pl - reads ONE of Brave's (Chromium's) own session files and prints the windows and tabs it describes, as they are now.
# Needs NO permission: it only reads a file in Brave's profile folder. Brave writes that file within a few seconds of every change
# (a tab opened, closed, moved, switched or taken to another page), so read just before Brave is asked to quit it is what Alan had open.
#   brave-session.pl <Session_... or Apps_... file>
# prints, one line per window:  window <tab> <window id> <tab> <kind: normal|app:<name>|other:<n>> <tab> open|closed <tab> <active tab index, from 0> <tab> bounds
#   then one line per tab:      tab <tab> <window id> <tab> <index in window> <tab> active|- <tab> <url> <tab> <title>
# The format is the one Chromium calls SNSS (versions 1 and 3): a list of small commands replayed in order. Only the commands that say
# which tabs are in which window, their order, their current page and which is active are read; everything else is skipped.
use strict; use warnings;
my $f = shift or die "usage: brave-session.pl <file>\n";
open(my $h, '<:raw', $f) or die "cannot read $f: $!\n";
local $/; my $d = <$h>; close $h;
die "not a session file\n" unless substr($d, 0, 4) eq 'SNSS';
my $ver = unpack('V', substr($d, 4, 4));
my $p = 8; my (%win, %tab);
sub pstr { my ($buf, $pos) = @_; my $n = unpack('V', substr($buf, $pos, 4)); my $s = substr($buf, $pos + 4, $n); return ($s, $pos + 4 + (($n + 3) & ~3)); }
sub pstr16 { my ($buf, $pos) = @_; my $n = unpack('V', substr($buf, $pos, 4)); my $s = substr($buf, $pos + 4, $n * 2); return ($s, $pos + 4 + ((2 * $n + 3) & ~3)); }
sub utf16 { my $s = shift; my $o = ''; eval { require Encode; $o = Encode::decode('UTF-16LE', $s); }; $o =~ s/[\t\n\r]/ /g; return $o; }
while ($p + 3 <= length $d) {
  my $size = unpack('v', substr($d, $p, 2)); my $id = unpack('C', substr($d, $p + 2, 1));
  my $pay = substr($d, $p + 3, $size - 1); $p += 2 + $size;
  last if $size < 1;
  if ($id == 0) { my ($w, $t) = unpack('l<l<', $pay); $tab{$t}{win} = $w; }                      # SetTabWindow
  elsif ($id == 2) { my ($t, $i) = unpack('l<l<', $pay); $tab{$t}{index} = $i; }                   # SetTabIndexInWindow
  elsif ($id == 6) {                                                                              # UpdateTabNavigation (a pickle)
    my $q = 4; my ($t, $i) = unpack('l<l<', substr($pay, $q, 8)); $q += 8;
    my ($url, $q2) = pstr($pay, $q); my ($title, $q3) = pstr16($pay, $q2);
    $tab{$t}{nav}{$i} = { url => $url, title => utf16($title) };
  }
  elsif ($id == 7) { my ($t, $i) = unpack('l<l<', $pay); $tab{$t}{nav_sel} = $i; }                 # SetSelectedNavigationIndex
  elsif ($id == 8) { my ($w, $i) = unpack('l<l<', $pay); $win{$w}{active} = $i; }                  # SetSelectedTabInIndex
  elsif ($id == 9) { my ($w, $k) = unpack('l<l<', $pay); $win{$w}{type} = $k; }                    # SetWindowType (0 normal, 2 app)
  elsif ($id == 12) { my ($t, $v) = unpack('l<l<', $pay); $tab{$t}{pinned} = $v; }                 # SetPinnedState
  elsif ($id == 14) { my ($w, $x, $y, $cw, $ch, $st) = unpack('l<l<l<l<l<l<', $pay); $win{$w}{bounds} = "$x,$y ${cw}x$ch state $st"; }
  elsif ($id == 15) { my $q = 4; my $w = unpack('l<', substr($pay, $q, 4)); my ($n) = pstr($pay, $q + 4); $win{$w}{app} = $n; }   # SetWindowAppName
  elsif ($id == 16) { my ($t) = unpack('l<', $pay); $tab{$t}{closed} = 1; }                         # TabClosed
  elsif ($id == 17) { my ($w) = unpack('l<', $pay); $win{$w}{closed} = 1; }                         # WindowClosed
  elsif ($id == 20) { my ($w) = unpack('l<', $pay); $win{$w}{last_active} = 1; }                   # SetActiveWindow
}
for my $w (sort { $a <=> $b } keys %win) {
  # Brave writes an app name for every window - an empty one for an ordinary window (seen on the iMac, 15 Oct 2026)
  my $kind = (defined $win{$w}{app} && $win{$w}{app} ne '') ? "app:$win{$w}{app}" : (($win{$w}{type} // 0) == 0 ? 'normal' : "other:$win{$w}{type}");
  printf "window\t%d\t%s\t%s\t%s\t%s\n", $w, $kind, $win{$w}{closed} ? 'closed' : 'open', $win{$w}{active} // '-', $win{$w}{bounds} // '-';
  next if $win{$w}{closed};
  my @tabs = grep { ($tab{$_}{win} // -1) == $w && !$tab{$_}{closed} } keys %tab;
  for my $t (sort { ($tab{$a}{index} // 0) <=> ($tab{$b}{index} // 0) } @tabs) {
    my $n = $tab{$t}{nav} or next; my $sel = $tab{$t}{nav_sel}; $sel = (sort { $b <=> $a } keys %$n)[0] unless defined $sel && $n->{$sel};
    my $e = $n->{$sel} or next;
    printf "tab\t%d\t%d\t%s\t%s\t%s\n", $w, $tab{$t}{index} // 0, (defined $win{$w}{active} && $win{$w}{active} == ($tab{$t}{index} // 0)) ? 'active' : '-', $e->{url}, $e->{title};
  }
}
