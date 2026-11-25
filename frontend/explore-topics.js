// One heading per group. A pipe introduces a spelling or wording from the
// transcriptions. An @ entry ID adds a reference when the wording is ambiguous
// or the entry continues an event named elsewhere. A leading ! makes a label
// display-only, so broad names can use more precise aliases or reviewed entries.
const source = `
# People
Albert Rathmell|Albert Rathmill
Alex Ducote|@E-aabe25e19a|@E-6275f088f2|@E-e4f7ea18f5|@E-cad8ce18ef|@E-3c94fd88c1|@E-bcc258f8b3
Alex Michelson
Art Shepherd
Ben Vaughn
Bill Hudspeth|Hudspeth
Bill Peace
Bob and Carlene Jenkins
Bob Fulbright
Bob Swanson
Bomboy
Bradley Houston|@E-798bd64a09
Brian Ring
Cactus Pryor
Cameron Pratt|@E-1680b03a4c|@E-ed2b609889|@E-ec72938425
!Captain Eddie|@E001|@E-a73bd50f4b
Captain Gerad
Caroline Knight
Carl French
Chad Ohlendorf|Chad Olandorf
Charles and Judy Durban
Chris Carothers|@E-2937dc666b|@E-cad8ce18ef|@E-3c94fd88c1|@E-ddda35d0a8
Chris Drakenberg
Chris Winslow
Clayton Yost
Clint Small
Coach Kuhio
Colby
Daniel Seymour|Doug’s son Daniel|@E-4cbc02d240|@E-49f0755ca6
D’armand Cook
!David Houston|@E-798bd64a09|@E-49cff0443e|@E-bcc258f8b3
Dick Chote
Doug Hague|Doug Hauge
Doug Seymour|@E-4cbc02d240|@E-49f0755ca6
Drew Van Quillen
Earl Regador|@E-46c2b0b713|@E-4c75798634|@E-7d68091d9c|@E-page-070-aug-13
Ed Small
Frank Niendorf
Fred Dippel|Fred Dipple
Gary Einkauf
Gary Schmitt
George Robinson
Guy Cellier
Hill Morrison
Ivan|friend Ivan
Jacob Ramos
James Vaughn|his son James
Jed Groom|Dr Groom
Jerry Kemchow
Jim Garrison
Jim Harmon
Jim Rizzuto
Bonnie Vaughn|Rick and Bonnie Vaughn
Joan Holt|Scott and Joan Holt
Joanne Mickelson
Joe Blankenship
Joe Martinez III
Joe Sullivan
John Avery
John Bagwell|Bagwell
John Oliver|Large John Oliver
John Price
John Treadwell
Joy Mickelson
Kathleen Schmitt|wife Kathleen
Kay Hart
Kevin|brother Kevin
Lester Ducote|@E-4eb0fe8c4f|@E-aabe25e19a|@E-e4f7ea18f5|@E-cad8ce18ef|@E-3c94fd88c1
Lightning Harrington
Logan
Gavin
Maddie Drew
Marianne Ferguson
Mary Lynn Woodall
Mike Fleming|Michael Fleming|Lt Mike Fleming|son Mike|son Michael
Mike Gillespie|Gillespie|Mike G
Mike Gouveia|Gouveia
Mike Hornsby
Missy
Moki
Morgan Stone
Moses
Nick von Kreisler
Nicole Beasley
Patricia|Patricia Ann|Patricia Tyler
Patrick Fleming|Patrick
Reagan Matsumura
Reed Fleming
Rick Darling
Rick Gaffney
Rick Pratt
!Ricky|his buddies Ricky|Ricky hooked
Rick Vaughn|Rick and Bonnie Vaughn
Robert Rivers
Roz|sister Roz
Scott Holt|Scott and Joan Holt
Scott Pruner|Scotty Pruner|Captain Scott Pruner|@E-de850b95f3|@E-ad23963a74|@E-page-070-aug-15
Shosana Matsumura|Shosana and Reagan Matsumura
Smokey
Steve Cochran
Steve and Becky Rivers
Susan Haney
Terry Bray
Todd Hanna
Todd Rubel
Tom Curtis
Tom Seibert|Tom Siebert|Tom Siebler
Val England
Walter Cardwell|Walter and Will Cardwell
Will Cardwell
Will Houston
William Page

# Places and ports
Austin
Captain Cook|Captain Cook Monument
Corpus Christi|Corpus Christi Airport
Gentry’s Marina
Hawaiʻi|Hawaii|Big Island of Hawaii
Honokōhau Harbor|Honokōhau|Konakahou Harbor
Kawaihae Harbor
Kealakekua Bay|Captain Cook Bay
Keauhou
!Kona|out of Kona|into Kona|see Kona|to Kona|at Kona|coming to Kona
Kona Paradise
Lighthouse Creek
Lighthouse Shore|lighthouse shoreline
Lydia Ann Channel|Lydia Ann Waterway|Lydia Ann
Miloliʻi
Pelican Island
Port Aransas|P.A.
Puʻuhonua o Hōnaunau (City of Refuge)|City of Refuge
Rockport
San Antonio
South Point
St. Joseph Island|St Joe Island|St Jo shoreline
Waimea

# Fishing grounds, reefs, rigs, and buoys
1941 lava flow|1941 flow
!A-7 platform|A7
Apache|at Apache
Baker|North Baker
Bell Buoy
Green Buoy
!Caves|off the caves
!Lava flows|lava flows|1941 flow|Lump Dick lava flow
!Lump Dick lava flow|Limpdick Man area
Big Blue|@E-2e540d032d
Big Platform
Big Red
Black 784
!C Buoy|C Buoy|between C and VV Buoy
!Cuda well|well I called Cuda
Double O Buoy
Dunnbar Reef|Dunnbar
Eastern Rock|Eastern Reef|Eastern GPS sites
Exxon platform
F Buoy
Farewell Anchorage
!Hawaiʻi fishing grounds|the grounds|the corner of the grounds
Hospital Reef|at Hospital|southeast of Hospital|from Hospital
Jack Up Rig
Kauai Point
!Kitchen|the Kitchen
Leaner Rig|number 781
Little Rigs
Lone Pipe
MU-A85|rig number 45
Mighty Whitey
North Jetty
OTEC|Otek Point
Pinnacle Rock
!Pines|the Pines|Pine Tree|Pine Shore
Red Hill
Rig 56|rig number 56
Rig 831|rig number 831
!Satellite rig|Satellite Rig|to Satellite|at Satellite
Scorpion Rig|@E-d779898898
!Southern Reef and rig|Southern Reef|Southern Rig|at Southern|to Southern|of Southern|do Southern|short of Southern
Sparkyville
Standpipes|stand pipes
!Top Corner|top corner of the grounds|@E-4cbc02d240
U Buoy
UU Buoy
UV Buoy
Val’s Rig
!VV / VW Buoy|VV Buoy|VW buoy|to VV|off VV|from VV|of VV|to VW|off VW|between VW|and VV|at VV
Way Ups|Way Up
Waypoint 21
Waypoint 38|waypoint number 38
Waypoint 42
Yellowlegs|672-A

# Fish and sharks
Albacore|tombo|tombos
Amberjack|amberjacks
Atlantic sharpnose shark|Atlantic sharpnose|Atlantic sharp nose shark
!Barracuda (fish)|barracudas|big barracuda|large barracuda|medium barracuda|pound barracuda|caught a barracuda|caught another barracuda|cuda lives|by a barracuda|after a barracuda|@E-88c0444433|@E-e593a8be00
Black marlin
Blackfin tuna
Blacktip shark|blacktips
Blue marlin|blue marlins
Blue runner|blue runners
Bonito / bonita|bonito|bonita
!Catfish (hardhead)|hard head|hardhead
Cobia (ling)|ling
Flying fish (fish)|chasing flying fish|few flying fish
Grouper
Jack crevalle|crevalle|jacks
Kingfish|king|kings
Mahi-mahi|mahi|mahis|chicken dolphin|bull dolphin|nice dolphin|first dolphin|six dolphin|and dolphin|smaller dolphin
Marlin|marlins
Rainbow runner|rainbow runners
Redfish|reds and trout|reds trout
Red snapper|sow snapper
Ribbonfish|ribbon fish
Shark|sharks
Skipjack tuna (aku)|aku|otado
Snapper|snappers
Snook
Spanish mackerel|legal Spanish
Spearfish (shortbill / chucker)|spearfish|shortbill|chucker|chuckers
Striped marlin|striped marlins|striper
Tarpon
Thresher shark|thresher
Triggerfish|triggers
Trout
Vermilion snapper|vermilion snapper|vermillion and red snapper
Wahoo (ono)|wahoo|ono|onos
Weke ʻula|weke ʻulas
Whitetip shark|whitetip|white tip
Yellowfin tuna (ahi / shibi)|yellowfin|ahi|shibi

# Boats
!Barracuda (boat)|on the Barracuda|the Barracuda picked up
Boston Whaler|foot Whaler
Deceiver
!Double O (boat)|boat the Double O|Oliver’s Double O|Double O boats
Knock Down
Kona Spirit
Mako
Marlin Mischief
Seahawk|@E001
!Silky|on the Silky
Skiff|the skiff
Wharf Cat

# Tournaments and outings
Corpus Christi Big Game Club tournament|Corpus Christi Big Game Club
Deep Sea Roundup|Port Aransas Deep Sea Tournament|@E-bc61517692|@E-3c94fd88c1|@E-67243d16d9
Firecracker Open|@E-a6b17240c7|@E-07fab86f69
GCCA tournament
Kona Turkey Bowl|Kona Turkey Day tournament
Marbridge trips|Marbridge trip
Port Aransas Outboard Tournament
Take a Kid Fishing tournament|Take a Kid Fishing
!Tournament press boat|@E-page-070-aug-14
University of Texas Marine Science Center|University of Texas Marine Science Board

# Lures and tackle
Ballyhoo
Blue-green squid skirt
!Captain Hague lure|Captain Hague on the stinger|Doug Hague’s lure|Doug Hague’s lures|Doug Hague’s flying fish|flying fish jet head by Captain Doug Hague|Doug Hauge jet head
Captain Gerad’s jet head
Dacron harness
Egg sinkers
Exterminator|Exterminators
Fighting chair|in the chair
Geoff Head
Hooties
Huntington spoons|Huntington spoon|Huntington drone spoons
Jet heads|jet head|Yo-Zuri jet
JT plunger
King Kings
Kona heads|Kona head|Kona plunger
Marauder|Marauders
Marlin Magic|Big Dog Marlin Magic
Monel wire and leaders|Monel wire|Monel leader
Mustad hook|Mustad long-shank hook
Mylar wings
Octopus skirts|octopus skirt|seven strand octopus
Outriggers|outrigger|rigger|riggers
Penn reels|Penn Reel|Penn 50|Penn 80|Penn 130|50-pound Penn|80-pound Penn|180-pound Penn|pound Penn|130 Penns|209 Penn
Pearl head
Pink and blue skirts|pink-blue skirt|pink and blue skirt
Ribbonfish bait|ribbon fish|ribbonfish
Sea anchor
Shark leaders
Soft heads|soft head|soft-head squid
Splash bait
Stinger|shotgun line
Trolling skirts|skirt|skirts
Yo-Zuri|Yo-Zuris|Yozuri

# Techniques and conditions
Bottom fishing|bottom fish|on the bottom
Breakoffs|break off|breakoff|broke the line|breaks the line|broke off
Catch, tag, and release|tag and release|tagged and released|tags and releases|caught and released
Chumming|chummed|chumming|chum line|chum up
Color changes|color change
Crabbing|crab traps|catch a dozen nice big blue crabs|caught 60 big blue crabs
Double hookups|double hookup|double on striped marlin|great double|mahi double
Downrigger
Drift fishing|drifting|drifted|set up a drift
Duck hunting|hunted Lighthouse Shore|duck boat
Fly fishing
Handlines|handline|handliners
Live bait|rigged live|live aku|live blue runner|live baiting|live snapper
Night fishing|night fish
Free-spooling|free-spooled
No strikes|not a strike|no hits
Oil platforms and gas wells|oil platform|oil rig|gas well|gas wells|standpipes|stand pipes
Rip lines|good rip|beautiful rip
Sargassum and weed lines|sargassum|sargassom|weed line|weed lines|floating seaweed|floater
Seasickness|seasick|queasy|mal de mer
Squalls|squall|squally
Trolling|troll|trolled
Tropical Storm Gabrielle
Tropical Depression
Vog
Waterspout
Whale watching

# Wildlife and bait
Blue crabs|blue crab
Coyote
Humpback whales|humpback whale|humpbacks
Minke whales
Pilot whales|pod of pilots
Porpoises|porpoise
Pygmy sperm whales
Seahorse
Shrimp|free shrimp
Squid|cut squid|giant squid
Stone crabs

# Boat work and logbook milestones
Boat purchase|boat was purchased
Boat blessing|blesses the boat
Bow rail
Crab boils|crab boil
!Birthday trips and celebrations|birthday trip|birthday gift|birthday party
Sashimi
Sea trials|shakedown period
Dumas Marine
Engine trouble|engine fails|lose port engine|lost the starboard engine|starboard engine flooded|port engine failed|engine trouble|one engine|head gasket|powerhead|fuel pump|resistor|stuck ring
Evinrude engines|Evinrude|Johnson 175
First blue marlin aboard the Seahawk|first blue marlin landed on the Seahawk
First offshore trip|first offshore trip
Fuel consumption|gallons per hour
GPS and navigation|GPS|LORAN|waypoint
Island Boat Works|Island Boatworks
Kona Coast Marine
Lowrance 350 GPS|Lowrance 350
Rig collision|ramming the rig
Teak work|teak trim
Launching and trailering|trailer in and out|boat put in the water|haul the boat
`;

export const collections = source.trim().split(/^# /m).filter(Boolean).map(section => {
  const [name, ...lines] = section.trim().split('\n');
  const topics = lines.filter(Boolean).map(line => {
    const [label, ...references] = line.split('|');
    return {
      label: label.replace(/^!/, ''),
      aliases: [...(label.startsWith('!') ? [] : [label]), ...references.filter(ref => !ref.startsWith('@'))],
      entryIds: references.filter(ref => ref.startsWith('@')).map(ref => ref.slice(1)),
    };
  });
  return { name, topics };
});
