/**
 * PUBLO - The Origin Story
 * A realistic screenplay about two guys and a girl building an AI writing platform in coastal towns
 */

export const PUBLO_SCREENPLAY = `---
format: screenplay
title: "PUBLO - The Origin Story"
structure:
  - id: act1
    level: 1
    name: "Act I - The Problem"
    wordCount: 3500
    summary: "Pal, a Norwegian developer in Bergen, struggles with AI-generated content becoming generic and lifeless. He dreams of a tool that makes AI writing creative and human. Meanwhile, in San Francisco, Maya discovers the same problem while trying to write her novel using AI tools."
  - id: act1_seq1
    level: 2
    name: "Sequence 1 - The Frustration"
    parentId: act1
    wordCount: 1800
    summary: "Pal and his friend Erik, a UX designer, discuss the limitations of current AI writing tools over coffee in Bergen's fish market. They brainstorm a radical new approach: what if AI could be directed like a film crew?"
  - id: act1_seq1_scene1
    level: 3
    name: "Scene 1 - The Coffee Meeting"
    parentId: act1_seq1
    wordCount: 900
    summary: "Pal shows Erik his latest AI-generated screenplay - it's technically correct but soulless. Erik sketches a visual interface on a napkin."
  - id: act1_seq1_scene2
    level: 3
    name: "Scene 2 - The Revelation"
    parentId: act1_seq1
    wordCount: 900
    summary: "Erik's napkin sketch becomes the first mockup of Publo's canvas interface. They realize: writers don't need more AI, they need orchestration."
  - id: act1_seq2
    level: 2
    name: "Sequence 2 - Parallel Paths"
    parentId: act1
    wordCount: 1700
    summary: "Cut to San Francisco where Maya, an aspiring author, fights with ChatGPT trying to write her novel. She tweets her frustration and Pal sees it. He reaches out."
  - id: act1_seq2_scene1
    level: 3
    name: "Scene 3 - Maya's Struggle"
    parentId: act1_seq2
    wordCount: 850
    summary: "Maya's apartment is covered in sticky notes with plot points. She asks ChatGPT for help but every suggestion feels wrong."
  - id: act1_seq2_scene2
    level: 3
    name: "Scene 4 - The DM"
    parentId: act1_seq2
    wordCount: 850
    summary: "Pal sends Maya a DM with a link to his prototype. She clicks it, skeptical but curious."
  - id: act2
    level: 1
    name: "Act II - The Build"
    wordCount: 5000
    summary: "Pal, Erik, and Maya form a remote team across two continents. They build the first version of Publo, facing technical challenges, funding struggles, and the constant question: will anyone actually want this?"
  - id: act2_seq1
    level: 2
    name: "Sequence 1 - First Zoom"
    parentId: act2
    wordCount: 1600
    summary: "The trio's first video call is awkward but electric. Maya tests Pal's prototype and her eyes light up - this is different. She becomes their first power user."
  - id: act2_seq1_scene1
    level: 3
    name: "Scene 5 - Meeting of Minds"
    parentId: act2_seq1
    wordCount: 1600
    summary: "Time zones collide. It's 2 AM in Bergen, 5 PM in San Francisco. Maya shares her screen showing Publo's canvas with character nodes connected to plot points."
  - id: act2_seq2
    level: 2
    name: "Sequence 2 - The Grind"
    parentId: act2
    wordCount: 2200
    summary: "Montage of late nights coding, design iterations, and breakthrough moments. Erik perfects the UI in Bergen's rainy cafes. Pal battles database issues in his home office. Maya writes her novel AND provides ruthless feedback."
  - id: act2_seq2_scene1
    level: 3
    name: "Scene 6 - Code and Coffee"
    parentId: act2_seq2
    wordCount: 1100
    summary: "Erik shows Pal his Figma designs for the Context Canvas. Pal says 'This is beautiful but impossible to code.' Erik grins: 'Good, make it possible.'"
  - id: act2_seq2_scene2
    level: 3
    name: "Scene 7 - The All-Nighter"
    parentId: act2_seq2
    wordCount: 1100
    summary: "Pal finally cracks the React Flow implementation at 4 AM. He screams 'IT WORKS!' and wakes his neighbors. He messages the group chat: 'We have orchestration.'"
  - id: act2_seq3
    level: 2
    name: "Sequence 3 - Reality Check"
    parentId: act2
    wordCount: 1200
    summary: "Money is running out. Erik takes freelance gigs to stay afloat. Maya juggles her barista job with testing. Pal considers giving up and going back to consulting."
  - id: act2_seq3_scene1
    level: 3
    name: "Scene 8 - The Crisis"
    parentId: act2_seq3
    wordCount: 1200
    summary: "A Zoom call where they debate shutting down. Then Maya shares something: she finished her novel using Publo and got an agent. Silence. Then Erik: 'Okay, we keep going.'"
  - id: act3
    level: 1
    name: "Act III - The Launch"
    wordCount: 3500
    summary: "After six months of intense development, they're ready to launch. But will anyone care? The team faces their biggest test: showing Publo to the world and hoping it resonates."
  - id: act3_seq1
    level: 2
    name: "Sequence 1 - Launch Day"
    parentId: act3
    wordCount: 1400
    summary: "They launch on Product Hunt. The first hour: nothing. Then a notification. Then ten. Then a hundred. Writers discover Publo and something magical happens: they get it immediately."
  - id: act3_seq1_scene1
    level: 3
    name: "Scene 9 - The Wait"
    parentId: act3_seq1
    wordCount: 1400
    summary: "Pal refreshes Product Hunt obsessively. Erik stress-eats pizza. Maya paces. Then the upvotes start rolling in. Someone comments: 'This is what I've been waiting for.'"
  - id: act3_seq2
    level: 2
    name: "Sequence 2 - Going Viral"
    parentId: act3
    wordCount: 1200
    summary: "A popular writing YouTuber makes a video about Publo. Traffic explodes. The servers crash. Pal works frantically to scale while Erik handles support tickets and Maya onboards new users."
  - id: act3_seq2_scene1
    level: 3
    name: "Scene 10 - The Scramble"
    parentId: act3_seq2
    wordCount: 1200
    summary: "Pal is on a video call with AWS support while simultaneously deploying fixes. Erik sees the error logs and makes memes about it to keep morale up. They survive the surge."
  - id: act3_seq3
    level: 2
    name: "Sequence 3 - The Future"
    parentId: act3
    wordCount: 900
    summary: "Three months post-launch. The trio meets in person for the first time in Bergen. They walk along the harbor, discussing what's next. The journey is just beginning."
  - id: act3_seq3_scene1
    level: 3
    name: "Scene 11 - The Harbor"
    parentId: act3_seq3
    wordCount: 900
    summary: "Golden hour in Bergen. Pal, Erik, and Maya stand by Bryggen, the colorful waterfront. Maya jokes: 'So... should we write a screenplay about this?' They all laugh. Fade out on the Publo logo reflected in the water."
---
# Act I - The Problem

## Sequence 1 - The Frustration

### Scene 1 - The Coffee Meeting

**EXT. BERGEN FISH MARKET - DAY**

Rain spatters the cobblestones. Tourists huddle under umbrellas, buying fresh salmon. PAL (32, Norwegian, sharp eyes behind glasses, hoodie) and ERIK (34, stylish despite the weather, designer jacket) sit at an outdoor café under a heat lamp.

Pal's laptop shows a screenplay generated by AI. Erik reads it, frowning.

**ERIK**  
(deadpan)  
This reads like a manual for assembling IKEA furniture.

**PAL**  
I know. But technically, it's correct. All the beats are there. Three-act structure, character arcs, the hero's journey...

**ERIK**  
It's also completely dead inside.

Pal closes the laptop, frustrated.

**PAL**  
That's the problem. Every AI tool gives you the same vanilla output. It's like... cooking with only salt.

Erik pulls out a napkin and starts sketching with a pen.

**ERIK**  
What if... what if you could direct the AI? Like a film director with a crew?

**PAL**  
(leaning in)  
What do you mean?

### Scene 2 - The Revelation

**INT. ERIK'S APARTMENT - BERGEN - NIGHT**

Erik's design studio. Multiple monitors. Figma open. The napkin sketch from the café is pinned to the wall.

Pal sits beside Erik as he creates mockups. Nodes and connections appear on screen, forming a network.

**ERIK**  
See? This node is your protagonist. This one is the location. This one is a plot twist. You drag, you connect, you orchestrate.

**PAL**  
(eyes widening)  
It's like React Flow... but for stories.

**ERIK**  
Exactly. And each node can have its own AI agent. They don't write FOR you, they write WITH you.

Pal grabs his laptop and starts coding immediately.

**PAL**  
This is it. This is what's missing.

**ERIK**  
What are we calling it?

**PAL**  
(thinking)  
Publo. Public... publishing... publishing flow... Publo.

**ERIK**  
(grinning)  
I like it. It's weird enough to work.

## Sequence 2 - Parallel Paths

### Scene 3 - Maya's Struggle

**INT. MAYA'S APARTMENT - SAN FRANCISCO - DAY**

Small studio apartment. Panoramic view of the Golden Gate Bridge, but MAYA (29, half-Vietnamese, coffee-stained flannel, determined eyes) isn't looking at it. Her walls are covered with sticky notes, character names, plot threads.

She's yelling at her laptop.

**MAYA**  
No, ChatGPT, I don't want a "mysterious stranger who changes everything." I want nuance. I want surprise. I want... ugh!

She deletes another paragraph. Opens Twitter.

**MAYA**  
(typing)  
"Why is every AI writing tool convinced my protagonist needs a dead mentor and a prophecy? I just want help outlining without lobotomizing my story. #WritingCommunity #AI"

She hits tweet, not expecting much.

### Scene 4 - The DM

**INT. PAL'S HOME OFFICE - BERGEN - LATE NIGHT**

Pal scrolls Twitter, procrastinating. He sees Maya's tweet. Something about it resonates. He clicks her profile. She's a writer, posts excerpts, clearly talented and frustrated.

He opens a DM.

**PAL**  
(typing)  
"Hey Maya, saw your tweet. I'm building something that might help. It's not another 'AI writes for you' tool. It's more like... conducting an orchestra. Want to try the prototype?"

He attaches a link. Hesitates. Sends it.

Hours pass. He's almost forgotten when his phone buzzes.

**MAYA (V.O.)**  
(DM notification)  
"Okay, I'm intrigued. Also, it's 5 PM here and I have nothing better to do. Let's see what you've got."

Pal grins.

# Act II - The Build

## Sequence 1 - First Zoom

### Scene 5 - Meeting of Minds

**INT. SPLIT SCREEN - PAL'S OFFICE / MAYA'S APARTMENT - NIGHT/EVENING**

Zoom call. Pal looks tired but excited. Erik is squeezed into frame. Maya looks skeptical but curious.

**MAYA**  
So... it's a flow chart?

**PAL**  
It's a canvas. Think of it like mind-mapping, but each node can talk to an AI.

**ERIK**  
Show her the demo, Pal.

Pal shares his screen. The Publo interface appears: a dark canvas with a few nodes and connections.

**PAL**  
This node is your story structure. This one is character information. This one is a research document. They all feed into this node here...

He clicks a node labeled "ORCHESTRATOR."

**PAL (CONT'D)**  
...which coordinates everything. You tell it what you need, and it consults the right sources.

**MAYA**  
(intrigued)  
Wait. So instead of one dumb AI, I get multiple smart ones that actually know my story?

**ERIK**  
Exactly.

Maya starts to smile.

**MAYA**  
Can I... can I try it? Like, right now?

**PAL**  
(panicking slightly)  
Uh, sure, but it's very rough—

**MAYA**  
I don't care. Send me the link.

## Sequence 2 - The Grind

### Scene 6 - Code and Coffee

**EXT. COFFEE SHOP - BERGEN - DAY**

Rain (always rain in Bergen). Erik shows Pal his Figma mockups on an iPad. The UI is sleek, modern, beautiful.

**ERIK**  
So the Context Canvas is here, the editor panel slides in from the right, and the timeline view is collapsible at the bottom.

**PAL**  
(overwhelmed)  
Erik, this is gorgeous. But I have no idea how to build this.

**ERIK**  
You figured out the orchestrator logic. You'll figure this out.

**PAL**  
That was backend. This is... animations, drag-and-drop, real-time collaboration...

**ERIK**  
(firm)  
Pal. You're one of the best developers I know. Make it happen.

Pal stares at the designs.

**PAL**  
(quietly)  
Okay. Okay, I'll make it happen.

### Scene 7 - The All-Nighter

**INT. PAL'S HOME OFFICE - BERGEN - 4 AM**

Empty Red Bull cans. Code everywhere. Pal's eyes are bloodshot. He's been at this for 14 hours straight.

On his screen, the React Flow canvas finally works. Nodes drag smoothly. Connections snap into place. The orchestrator node pulses with life.

**PAL**  
(whisper)  
It... it works.

He tests it again. Dragging, connecting, clicking. Everything flows.

**PAL**  
(louder)  
IT WORKS!

He jumps up, fist in the air. From next door, muffled Norwegian yelling:

**NEIGHBOR (V.O.)**  
(Norwegian, subtitled)  
"SOME OF US ARE SLEEPING!"

Pal doesn't care. He opens Slack.

**PAL**  
(typing)  
"@everyone WE HAVE ORCHESTRATION 🎉"

## Sequence 3 - Reality Check

### Scene 8 - The Crisis

**INT. ZOOM CALL - THREE PANELS - DAY**

The mood is somber. Pal looks exhausted. Erik is working from a café, clearly multitasking. Maya is in her barista uniform.

**ERIK**  
So... my savings are pretty much gone. I need to take on freelance work.

**PAL**  
I get it. I'm thinking about... maybe going back to consulting. Just for a few months.

**MAYA**  
(quiet)  
Should we just... shut it down?

Silence. The weight of failure hangs heavy.

**MAYA (CONT'D)**  
I finished my novel.

**PAL**  
What?

**MAYA**  
Using Publo. I finished my novel. And I got an agent. They want to shop it to publishers.

**ERIK**  
(stunned)  
You're serious?

**MAYA**  
Dead serious. Publo did what no other tool could - it let me stay creative while handling the logistics. It worked, guys. It actually worked.

Long pause. Erik and Pal look at each other.

**ERIK**  
Okay. We keep going.

**PAL**  
(nodding)  
We keep going.

# Act III - The Launch

## Sequence 1 - Launch Day

### Scene 9 - The Wait

**INT. PAL'S APARTMENT - BERGEN - DAY**

Launch day. Pal, Erik, and Maya are all on Zoom. Pal's screen shows Product Hunt. The post is live: "Publo - AI writing orchestration for creative minds."

0 upvotes.

**ERIK**  
Maybe... maybe it takes time?

**PAL**  
(refreshing)  
Maybe.

They wait. Minutes feel like hours. Then:

**NOTIFICATION SOUND**

+1 upvote.

Then another. Then ten. Then fifty.

**MAYA**  
Guys... check the comments.

**PAL**  
(reading)  
"Holy shit, this is what I've been waiting for."

**ERIK**  
"Finally, an AI tool that doesn't make me feel like a robot."

**MAYA**  
"This changes everything."

They watch in stunned silence as the numbers climb.

## Sequence 2 - Going Viral

### Scene 10 - The Scramble

**INT. MULTI-SCREEN CHAOS - DAY**

Pal is on a video call with AWS support, deploying emergency scaling fixes while monitoring error logs. Sweat on his forehead.

Erik is handling the Discord server, answering questions faster than they come in.

Maya is writing onboarding emails and tweets, her phone exploding with notifications.

**PAL**  
(to AWS rep)  
Yes, I need to scale to 500 concurrent users. Now. Please.

**ERIK**  
(on Discord)  
No, it's not crashed, just... very loved right now!

**MAYA**  
(on camera)  
Thank you all for the patience! Pal is literally holding the servers together with duct tape and Norwegian curse words!

The servers stabilize. The traffic normalizes. They did it.

## Sequence 3 - The Future

### Scene 11 - The Harbor

**EXT. BRYGGEN WHARF - BERGEN - GOLDEN HOUR**

Three months later. The colorful wooden buildings of Bryggen glow in the sunset. Pal, Erik, and Maya walk along the harbor, tourists and locals around them.

This is their first time meeting in person.

**MAYA**  
So this is Bergen. It's... actually beautiful.

**ERIK**  
When it's not raining, yeah.

**PAL**  
(checking his phone)  
We hit 10,000 users today.

They stop walking. Let it sink in.

**MAYA**  
Remember when we almost quit?

**ERIK**  
Remember when we thought nobody would get it?

**PAL**  
(smiling)  
We were idiots.

They laugh. Stand by the water, looking out at the fjord.

**MAYA**  
So what's next?

**PAL**  
Supabase is asking about an integration. We're talking to some VCs. And I have about a thousand feature requests.

**ERIK**  
Good problems.

**MAYA**  
Should we write a screenplay about this? The Publo origin story?

They all laugh.

**ERIK**  
Using Publo, obviously.

**PAL**  
Obviously.

They stand together as the sun sets, reflected in the calm water. The Publo logo appears as a reflection.

**FADE TO BLACK**

**THE END**

---

**Post-credits scene:**

**INT. PAL'S OFFICE - 6 MONTHS LATER**

Pal opens Publo. On the canvas: nodes labeled "Erik character," "Maya character," "Pal character," connected to a structure node labeled "Publo - The Movie."

He grins and clicks "Generate Structure."

**SMASH CUT TO:**

**PUBLO LOGO**

**Coming soon.**
`

