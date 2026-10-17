// Learning-flow data for each feed lesson, keyed by its stable lesson ID (src/feed/clips.ts).
// Ported on 2026-10-15 from the earlier implementation (git stash, docs/lane/03-old-backend-port-map.md).
//
// - topicId and safety (0.50–1.00, used by review priority) are author settings for the owner to confirm.
// - similar / harder questions and decision activities are agent drafts: each is marked draft: true
//   and cites the handbook. A human approves a draft before it ships as reviewed content.
// - Simulations are mapped to lessons in src/simulation/registry.ts, not here.
// - keySegment (seconds) marks the part of each clip that teaches the rule, read from the clip itself
//   (frame-by-frame review, 2026-10-15; docs/lane/10-content-index.md). "Watch the important part" plays only it.
// - recall is the lesson's flashcard (active recall); glossary links a card in src/content/cards.ts.

export type DraftQuestion = { question: string; options: string[]; answer: number; explanation: string; draft: true; source: string };
export type DecisionChoice = { label: string; safe: boolean; feedback: string };
export type DecisionActivity = { id: string; prompt: string; draft: true; source: string; choices: DecisionChoice[] };
export type RecallCard = { front: string; back: string; draft: true; source: string };
export type LessonLearning = {
  topicId: string;
  safety: number;
  similar: DraftQuestion;
  harder: DraftQuestion;
  activity?: DecisionActivity;
  keySegment?: { start: number; end: number };
  recall?: RecallCard;
  glossary?: string;
};

// Important lessons (S ≥ 0.8) ask "Are you sure?" when left before the video ends.
export const SAFETY_GATE = 0.8;
// Below this safety weight, a first visit is checked with the lesson's flashcard instead of a full quiz.
export const QUIZ_SAFETY = 0.7;

export const LEARNING: Record<string, LessonLearning> = {
  "lane-end-scan": {
    "topicId": "road-awareness",
    "safety": 0.8,
    "similar": {
      "question": "In the video, the driver spots the right-lane sign early. What does seeing it early let you do?",
      "options": [
        "Speed up and pass the cars in the next lane",
        "Plan a smooth, signaled lane change in time",
        "Stay in the lane until it ends, then merge"
      ],
      "answer": 1,
      "explanation": "Scanning ahead gives you time to react and avoid last-minute moves, so you can signal and change lanes calmly.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 6, Scan Your Surroundings, p. 44"
    },
    "harder": {
      "question": "Your lane ends ahead and you need to move left. Which order is correct?",
      "options": [
        "Check mirrors, move over, then signal once you are in the lane",
        "Signal, check mirrors, look over your shoulder, then move with enough space",
        "Signal, then move over right away so drivers know your plan"
      ],
      "answer": 1,
      "explanation": "Signal first, check your mirrors and traffic, look over your shoulder for your blind spot, and change lanes only when there is enough space.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 4, Changing Lanes, p. 8"
    },
    "activity": {
      "id": "decision-01",
      "prompt": "A right-lane-ends warning appears ahead on a busy multilane road. What do you do?",
      "draft": true,
      "source": "Decision prompt adapted from Lane — California Driver Education: Video Lessons, Quizzes & Decision Prompts (owner curriculum); California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 4, Changing Lanes",
      "choices": [
        {
          "label": "Signal, check mirrors and blind spot, then merge into a gap",
          "safe": true,
          "feedback": "Planning early and merging only after every check keeps the move smooth and predictable."
        },
        {
          "label": "Keep scanning and hold your lane until a safe gap appears",
          "safe": true,
          "feedback": "Waiting for enough space is safe. Signal and check again before you move."
        },
        {
          "label": "Wait until the lane ends, then merge without signaling",
          "safe": false,
          "feedback": "A last-minute, unsignaled merge surprises other drivers. Use the early warning to plan, signal, and check."
        }
      ]
    },
    "keySegment": {
      "start": 10,
      "end": 21
    },
    "recall": {
      "front": "How far ahead should you scan while driving?",
      "back": "At least 10 seconds ahead of your car. Counting seconds works at any speed.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 6, Scan Your Surroundings, p. 44"
    },
    "glossary": "glossary-visual-lead-time"
  },
  "after-collision": {
    "topicId": "emergencies",
    "safety": 1,
    "similar": {
      "question": "After a collision, a passenger in the other car says their neck hurts. What should you do first?",
      "options": [
        "Move both cars to a parking lot before calling anyone",
        "Call 911 right away",
        "Trade insurance details and leave"
      ],
      "answer": 1,
      "explanation": "Call 911 right away if anyone is hurt. People who are injured get help faster when the road is not blocked by onlookers.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 8, What to Do if You Are in a Collision"
    },
    "harder": {
      "question": "A collision caused about $1,500 in property damage and no injuries. Do you need to report it to DMV?",
      "options": [
        "No, only injury collisions are reported",
        "Only if a police officer wrote a report",
        "Yes, within 10 days, using form SR 1"
      ],
      "answer": 2,
      "explanation": "Report to DMV within 10 days if damage is over $1,000 or anyone is hurt, whether or not you caused it. Law enforcement does not file it for you.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 8, Reporting a Collision"
    },
    "activity": {
      "id": "decision-02",
      "prompt": "You are in a low-speed collision. No one is hurt, and your car can still move.",
      "draft": true,
      "source": "Decision prompt adapted from Lane — California Driver Education: Video Lessons, Quizzes & Decision Prompts (owner curriculum); California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 8, What to Do if You Are in a Collision",
      "choices": [
        {
          "label": "Move out of traffic, then call 911",
          "safe": true,
          "feedback": "Correct. Then show your license, registration, insurance, and current address to the other driver."
        },
        {
          "label": "Check your own car and leave if it looks fine",
          "safe": false,
          "feedback": "You must stop. Leaving the scene is a hit-and-run, even after a minor collision."
        },
        {
          "label": "Stay stopped in the traffic lane until police arrive",
          "safe": false,
          "feedback": "If no one is hurt and the car can move, move it out of traffic first, then call 911."
        }
      ]
    },
    "keySegment": {
      "start": 4,
      "end": 23
    },
    "recall": {
      "front": "When must you report a collision to DMV?",
      "back": "Within 10 days, on form SR 1, if damage is over $1,000 or anyone is hurt or killed.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 8, Reporting a Collision, p. 59"
    },
    "glossary": "glossary-collision"
  },
  "emergency-kit": {
    "topicId": "car-readiness",
    "safety": 0.6,
    "similar": {
      "question": "Your car stalls on the freeway and you must get out. Which side should you exit from?",
      "options": [
        "The side next to traffic",
        "The right side, away from traffic",
        "Whichever door is closest to you"
      ],
      "answer": 1,
      "explanation": "Exit on the right side so you are away from traffic, and get back in from the right side.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 6, If Your Vehicle Becomes Disabled on the Freeway"
    },
    "harder": {
      "question": "You have pulled onto the right shoulder after a freeway breakdown. Where should you wait for help?",
      "options": [
        "Inside the vehicle with your seat belt on",
        "Standing behind the vehicle so others can see you",
        "Walking toward the next exit"
      ],
      "answer": 0,
      "explanation": "Stay inside with your seat belt on until help arrives. Use your emergency flashers so others can see you.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 6, If Your Vehicle Becomes Disabled on the Freeway"
    },
    "keySegment": {
      "start": 7,
      "end": 14
    },
    "recall": {
      "front": "Your car breaks down on the freeway. Where do you wait for help?",
      "back": "Pull safely onto the right shoulder, turn on your flashers, and stay inside with your seat belt on.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 6, If Your Vehicle Becomes Disabled on the Freeway, p. 53"
    },
    "glossary": "glossary-shoulder"
  },
  "front-curb": {
    "topicId": "vehicle-control",
    "safety": 0.6,
    "similar": {
      "question": "Before pulling forward into a parking space, what should you check besides your reference point?",
      "options": [
        "The fuel gauge and your mirrors",
        "People in your path and curb color",
        "Only the car parked beside you"
      ],
      "answer": 1,
      "explanation": "Check for pedestrians and obey curb colors and posted signs. A reference point only helps you judge distance.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 4, Parking at Colored Curbs; Illegal Parking"
    },
    "harder": {
      "question": "The curb beside an open space is painted red. What does that mean?",
      "options": [
        "Parking for up to 20 minutes",
        "Passenger loading only",
        "No stopping, standing, or parking"
      ],
      "answer": 2,
      "explanation": "A red curb means no stopping, standing, or parking. Buses may stop at a red zone marked for buses.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 4, Parking at Colored Curbs"
    },
    "activity": {
      "id": "decision-04",
      "prompt": "You are pulling slowly toward a front curb when a pedestrian starts crossing in front of you.",
      "draft": true,
      "source": "Decision prompt adapted from Lane — California Driver Education: Video Lessons, Quizzes & Decision Prompts (owner curriculum); California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 5, Pedestrians",
      "choices": [
        {
          "label": "Stop and yield, then recheck your path before moving",
          "safe": true,
          "feedback": "Pedestrians have the right-of-way. Use your mirror reference only after the path is clear."
        },
        {
          "label": "Keep rolling and line up your mirror reference",
          "safe": false,
          "feedback": "A reference point does not see people. Stop and let the pedestrian finish crossing."
        }
      ]
    },
    "keySegment": {
      "start": 3,
      "end": 12
    },
    "recall": {
      "front": "What does a red curb mean?",
      "back": "No stopping, standing, or parking.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 4, Parking at Colored Curbs, p. 20"
    },
    "glossary": "glossary-pedestrian"
  },
  "dark-signal": {
    "topicId": "right-of-way",
    "safety": 0.9,
    "similar": {
      "question": "A traffic signal is completely dark. How should you treat the intersection?",
      "options": [
        "As if there are STOP signs in all directions",
        "As a yield-only intersection",
        "As if the main road still has a green light"
      ],
      "answer": 0,
      "explanation": "Stop as if the intersection is controlled by STOP signs in all directions, then go cautiously when safe.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 5, Traffic Light Not Working"
    },
    "harder": {
      "question": "At a dark signal you stopped first, and another car stops after you on your right. What do you do?",
      "options": [
        "Wait, because the car on your right always goes first",
        "Proceed cautiously when safe, because you arrived first",
        "Wait until the signal starts working again"
      ],
      "answer": 1,
      "explanation": "The vehicle that arrives first has the right-of-way. Yield to the right only when you arrive at the same time.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 5, Intersections"
    },
    "activity": {
      "id": "decision-05",
      "prompt": "The signal is dark. You and a car on your right stop at the same moment.",
      "draft": true,
      "source": "Decision prompt adapted from Lane — California Driver Education: Video Lessons, Quizzes & Decision Prompts (owner curriculum); California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 5, Traffic Light Not Working; Intersections",
      "choices": [
        {
          "label": "Yield to the car on your right, then go when it is clear",
          "safe": true,
          "feedback": "When you arrive together, the vehicle on your right goes first. Check again before you enter."
        },
        {
          "label": "Go first because you are going straight through",
          "safe": false,
          "feedback": "Going straight does not give you priority. Yield to the vehicle on your right."
        },
        {
          "label": "Roll through slowly without a full stop",
          "safe": false,
          "feedback": "A dark signal works like a STOP sign in every direction. Come to a complete stop first."
        }
      ]
    },
    "keySegment": {
      "start": 8,
      "end": 16
    },
    "recall": {
      "front": "A traffic light is completely dark. How do you treat the intersection?",
      "back": "As if there are STOP signs in all directions.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 5, Traffic Light Not Working, p. 25"
    },
    "glossary": "glossary-right-of-way"
  },
  "emergency-pull-right": {
    "topicId": "emergency-vehicles",
    "safety": 1,
    "similar": {
      "question": "You are already in an intersection when you hear the siren behind you. What do you do?",
      "options": [
        "Stop in the middle of the intersection",
        "Keep going through, then pull right and stop",
        "Back up out of the intersection"
      ],
      "answer": 1,
      "explanation": "Never stop in an intersection. Continue through it, then drive to the right edge and stop as soon as it is safe.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 5, Emergency Vehicles, p. 35"
    },
    "harder": {
      "question": "How close may you legally follow a fire engine that has its siren or flashing lights on?",
      "options": [
        "No closer than 300 feet",
        "No closer than 100 feet",
        "Any distance, if you keep pace"
      ],
      "answer": 0,
      "explanation": "It is against the law to follow within 300 feet of an emergency vehicle using its siren or flashing lights.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 5, Emergency Vehicles"
    },
    "activity": {
      "id": "decision-06",
      "prompt": "You are in the middle of an intersection when you hear a siren and see red lights behind you.",
      "draft": true,
      "source": "Decision prompt adapted from Lane — California Driver Education: Video Lessons, Quizzes & Decision Prompts (owner curriculum); California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 5, Emergency Vehicles",
      "choices": [
        {
          "label": "Clear the intersection, then pull right and stop",
          "safe": true,
          "feedback": "Clearing the intersection keeps the path open. Then move right and stop until it passes."
        },
        {
          "label": "Stop right where you are in the intersection",
          "safe": false,
          "feedback": "Stopping in the intersection can block the emergency vehicle. Clear it first."
        }
      ]
    },
    "keySegment": {
      "start": 8,
      "end": 15
    },
    "recall": {
      "front": "How close may you follow a fire engine that has its siren on?",
      "back": "No closer than 300 feet.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 5, Emergency Vehicles, p. 35"
    },
    "glossary": "glossary-yield"
  },
  "emergency-right-edge": {
    "topicId": "emergency-vehicles",
    "safety": 1,
    "similar": {
      "question": "You are on a two-lane road and hear a siren behind you. Which way do you move?",
      "options": [
        "Toward the center line",
        "To the right edge of the road",
        "Onto the left shoulder"
      ],
      "answer": 1,
      "explanation": "Move to the right edge and stop until the emergency vehicle has passed.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 5, Emergency Vehicles"
    },
    "harder": {
      "question": "Ahead, an emergency vehicle is stopped with its flashing lights on. What should you do?",
      "options": [
        "Move over and slow down",
        "Stop behind it until it leaves",
        "Pass it at your normal speed"
      ],
      "answer": 0,
      "explanation": "When approaching a stationary emergency vehicle with flashing lights, move over and slow down.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 5, Emergency Vehicles; Move Over and Slow Down"
    },
    "activity": {
      "id": "decision-07",
      "prompt": "An ambulance with a siren and red lights appears behind you before you reach an intersection.",
      "draft": true,
      "source": "Decision prompt adapted from Lane — California Driver Education: Video Lessons, Quizzes & Decision Prompts (owner curriculum); California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 5, Emergency Vehicles",
      "choices": [
        {
          "label": "Move to the right edge and stop",
          "safe": true,
          "feedback": "You are not in the intersection yet, so pull right and stop until it passes."
        },
        {
          "label": "Pull over to the left edge",
          "safe": false,
          "feedback": "In California, yield by moving to the right edge of the road."
        },
        {
          "label": "Keep going at the same speed",
          "safe": false,
          "feedback": "You must yield. Move to the right edge and stop."
        }
      ]
    },
    "keySegment": {
      "start": 20,
      "end": 28
    },
    "recall": {
      "front": "An emergency vehicle with a siren is behind you. Where do you go?",
      "back": "To the right edge of the road. Stop until it passes.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 5, Emergency Vehicles, p. 35"
    },
    "glossary": "glossary-yield"
  },
  "intersection-right-of-way": {
    "topicId": "right-of-way",
    "safety": 0.9,
    "similar": {
      "question": "At an intersection with no signs, you and a bicyclist arrive together. The bicyclist is on your right. What do you do?",
      "options": [
        "Go first, since you are driving straight",
        "Yield to the bicyclist, then go when clear",
        "Speed up so you clear it before them"
      ],
      "answer": 1,
      "explanation": "At the same time, yield to the vehicle, pedestrian or bicyclist on your right.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 5, Intersections, p. 30"
    },
    "harder": {
      "question": "At a T intersection with no STOP or YIELD signs, you are on the road that ends. Who has the right-of-way?",
      "options": [
        "Traffic on the through road",
        "You, because you are turning",
        "Whoever is on the right"
      ],
      "answer": 0,
      "explanation": "At a T intersection without signs, vehicles, bicyclists, and pedestrians on the through road have the right-of-way.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 5, Intersections"
    },
    "activity": {
      "id": "decision-08",
      "prompt": "You and a car on your right stop together at a four-way stop. A pedestrian is waiting to cross.",
      "draft": true,
      "source": "Decision prompt adapted from Lane — California Driver Education: Video Lessons, Quizzes & Decision Prompts (owner curriculum); California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 5, Intersections; Pedestrians",
      "choices": [
        {
          "label": "Yield to the pedestrian and the car on your right",
          "safe": true,
          "feedback": "Both have the right-of-way here. Proceed only when the crosswalk and intersection are clear."
        },
        {
          "label": "Go first because you came to a complete stop",
          "safe": false,
          "feedback": "Stopping completely does not give you priority over someone who arrived at the same time on your right."
        }
      ]
    },
    "keySegment": {
      "start": 6,
      "end": 20
    },
    "recall": {
      "front": "You and another car reach an intersection with no signs at the same time. Who goes first?",
      "back": "The one on your right. Yield to the vehicle, pedestrian or bicyclist on your right.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 5, Intersections, p. 30"
    },
    "glossary": "glossary-uncontrolled-intersection"
  },
  "high-beams": {
    "topicId": "night-and-weather",
    "safety": 0.8,
    "similar": {
      "question": "At night you are following another vehicle. When must your high beams be dimmed?",
      "options": [
        "Within 300 feet of the vehicle ahead",
        "Within 50 feet of the vehicle ahead",
        "Only when it signals a turn"
      ],
      "answer": 0,
      "explanation": "Dim your high beams within 300 feet of a vehicle you are following.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 3, Using Your Headlights"
    },
    "harder": {
      "question": "You are driving at night in heavy fog. Which lights should you use?",
      "options": [
        "High beams",
        "Low beams",
        "Parking lights only"
      ],
      "answer": 1,
      "explanation": "Use low beams. High beams reflect off the fog and cause glare. Never drive using only parking or fog lights.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 6, Fog or Heavy Smoke"
    },
    "activity": {
      "id": "decision-09",
      "prompt": "You are on a dark, open road with your high beams on when an oncoming car appears.",
      "draft": true,
      "source": "Decision prompt adapted from Lane — California Driver Education: Video Lessons, Quizzes & Decision Prompts (owner curriculum); California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 3, Using Your Headlights",
      "choices": [
        {
          "label": "Switch to low beams",
          "safe": true,
          "feedback": "Dimming within 500 feet keeps the other driver from being blinded."
        },
        {
          "label": "Keep the high beams on so you can see farther",
          "safe": false,
          "feedback": "High beams can blind an oncoming driver. Switch to low beams."
        }
      ]
    },
    "keySegment": {
      "start": 8,
      "end": 32
    },
    "recall": {
      "front": "Fog, rain or snow: which headlights must you use?",
      "back": "Low beams.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 3, Using Your Headlights, p. 4"
    }
  },
  "passing-bicyclist": {
    "topicId": "sharing-the-road",
    "safety": 1,
    "similar": {
      "question": "Oncoming traffic means you can’t give a bicyclist 3 feet right now. What do you do?",
      "options": [
        "Pass slowly as far left as your lane allows",
        "Slow down and wait until you can give 3 feet",
        "Honk so the bicyclist moves over first"
      ],
      "answer": 1,
      "explanation": "If you cannot give three feet, do not pass until you can.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 5, Passing a Bicyclist, pp. 36–37"
    },
    "harder": {
      "question": "You plan to turn right, and a bike lane runs next to you. When may you enter the bike lane?",
      "options": [
        "Anywhere along the block",
        "Within 200 feet of the turn, after checking",
        "Never; turn across it from your lane"
      ],
      "answer": 1,
      "explanation": "You may drive in a bike lane within 200 feet of a turn. Check your blind spots for bicyclists first.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 4, Bicycle Lanes; Section 5, Passing a Bicyclist"
    },
    "activity": {
      "id": "decision-10",
      "prompt": "A bicyclist is ahead of you on a two-lane street, and an oncoming car is coming.",
      "draft": true,
      "source": "Decision prompt adapted from Lane — California Driver Education: Video Lessons, Quizzes & Decision Prompts (owner curriculum); California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 6, Choose Between Hazards",
      "choices": [
        {
          "label": "Slow down and wait, then pass with at least 3 feet",
          "safe": true,
          "feedback": "Take one hazard at a time. Let the oncoming car pass, then give the bicyclist plenty of room."
        },
        {
          "label": "Squeeze between the bicyclist and the oncoming car now",
          "safe": false,
          "feedback": "That leaves no margin for either of them. Wait until you can give at least three feet."
        }
      ]
    },
    "keySegment": {
      "start": 4,
      "end": 16
    },
    "recall": {
      "front": "Minimum space when passing a bicyclist?",
      "back": "At least 3 feet. If you can’t give it, wait.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 5, Passing a Bicyclist, pp. 36–37"
    },
    "glossary": "glossary-vulnerable-road-users"
  },
  "freeway-entry": {
    "topicId": "freeway",
    "safety": 0.9,
    "similar": {
      "question": "Just before you merge from the ramp, what should you check?",
      "options": [
        "Only your rearview mirror",
        "Mirrors and over your shoulder, signal on",
        "Nothing; freeway drivers must make room"
      ],
      "answer": 1,
      "explanation": "Use your mirrors and turn signal, and turn your head to look over your shoulder before merging.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 4, Merging, p. 16"
    },
    "harder": {
      "question": "How much space do you need to enter traffic on a highway?",
      "options": [
        "About half a block, 150 feet",
        "About a full block, 300 feet",
        "About one car length"
      ],
      "answer": 1,
      "explanation": "When entering highway traffic, allow a gap of about a full block, roughly 300 feet. Half a block is the guide for city streets.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 4, Crossing or Entering Traffic"
    },
    "activity": {
      "id": "decision-11",
      "prompt": "In the acceleration lane, the opening ahead is too small, but a better gap may come up behind it.",
      "draft": true,
      "source": "Decision prompt adapted from Lane — California Driver Education: Video Lessons, Quizzes & Decision Prompts (owner curriculum); California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 4, Merging",
      "choices": [
        {
          "label": "Keep yielding and adjust speed until an adequate gap opens",
          "safe": true,
          "feedback": "Freeway traffic has the right-of-way. Merge only into a space large enough for your car."
        },
        {
          "label": "Force your way into the small gap",
          "safe": false,
          "feedback": "A forced merge takes away another driver’s space. Wait for a gap that fits."
        },
        {
          "label": "Stop at the end of the ramp and wait for a gap",
          "safe": false,
          "feedback": "Stop only if absolutely necessary. Adjusting speed usually reveals a safe gap."
        }
      ]
    },
    "keySegment": {
      "start": 14,
      "end": 28
    },
    "recall": {
      "front": "Merging onto a freeway: who has the right-of-way?",
      "back": "Traffic already on the freeway.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 4, Merging, p. 15"
    },
    "glossary": "glossary-interchange"
  },
  "freeway-merge": {
    "topicId": "freeway",
    "safety": 0.9,
    "similar": {
      "question": "On the on-ramp, the only open gap is too small for your car. What is the safest choice?",
      "options": [
        "Merge anyway and let others adjust",
        "Keep yielding and adjust your speed",
        "Cross the solid line to reach a gap"
      ],
      "answer": 1,
      "explanation": "Merge only into a space large enough for your vehicle, and never cross a solid line to do it.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 4, Merging"
    },
    "harder": {
      "question": "After merging, you need to cross several freeway lanes. How should you do it?",
      "options": [
        "One at a time, checking blind spots each time",
        "All at once in one smooth move",
        "Use the shoulder to get around traffic"
      ],
      "answer": 0,
      "explanation": "Cross lanes one at a time, signaling and checking for vehicles, motorcyclists, and bicyclists each time.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 4, Merging"
    },
    "activity": {
      "id": "decision-12",
      "prompt": "You are near the end of the on-ramp. After your mirror, signal, and shoulder check, a large gap is open.",
      "draft": true,
      "source": "Decision prompt adapted from Lane — California Driver Education: Video Lessons, Quizzes & Decision Prompts (owner curriculum); California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 4, Merging",
      "choices": [
        {
          "label": "Merge into the gap at or near traffic speed",
          "safe": true,
          "feedback": "You have checked and the gap fits. Merge smoothly without crossing a solid line."
        },
        {
          "label": "Stop at the ramp’s end and wait anyway",
          "safe": false,
          "feedback": "Stopping when a safe gap is available disrupts the merge. Stop only if absolutely necessary."
        }
      ]
    },
    "keySegment": {
      "start": 6,
      "end": 22
    },
    "recall": {
      "front": "Merging onto a freeway: may you cross a solid white line?",
      "back": "No. Do not cross any solid lines when merging.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 4, Merging, p. 16"
    }
  },
  "drive-test-readiness": {
    "topicId": "drive-test",
    "safety": 0.6,
    "similar": {
      "question": "When you stop behind another vehicle, how much space should you leave?",
      "options": [
        "Enough to see its rear tires",
        "About one foot",
        "As little as possible"
      ],
      "answer": 0,
      "explanation": "Leave enough space to see the rear wheels of the vehicle ahead.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 4, Braking"
    },
    "harder": {
      "question": "Where should you stop at an intersection that has a limit line?",
      "options": [
        "Past the line, at the edge of the crosswalk",
        "Behind the limit line",
        "With your front wheels on the line"
      ],
      "answer": 1,
      "explanation": "Stop behind the limit line. Without one, stop before the crosswalk; without a crosswalk, before the intersection.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 4, Right Turns; Braking"
    },
    "keySegment": {
      "start": 14,
      "end": 26
    },
    "recall": {
      "front": "How far before a turn should you start signaling?",
      "back": "About 100 feet before the turn.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 3, Signaling, pp. 3–4"
    },
    "glossary": "glossary-drive-test"
  },
  "blind-spot-check": {
    "topicId": "blind-spots",
    "safety": 0.9,
    "similar": {
      "question": "Your mirrors look clear, but a motorcycle could be beside you. When do you change lanes?",
      "options": [
        "Right away, since the mirrors look clear",
        "After a shoulder check shows the space is clear",
        "After honking to warn anyone beside you"
      ],
      "answer": 1,
      "explanation": "Blind spots cannot be seen in mirrors. Only a look over your shoulder shows the space is clear.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 6, Blind Spots, p. 45"
    },
    "harder": {
      "question": "Which of these also calls for a blind-spot check?",
      "options": [
        "Opening your car door next to traffic",
        "Waiting at a red light in your lane",
        "Turning on your headlights at dusk"
      ],
      "answer": 0,
      "explanation": "Check blind spots before you change lanes, turn, merge, back up, leave a parking space, pull out from the curb, or open your door.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 6, Blind Spots"
    },
    "activity": {
      "id": "decision-14",
      "prompt": "You plan to merge one lane left, and a bicyclist may be riding alongside.",
      "draft": true,
      "source": "Decision prompt adapted from Lane — California Driver Education: Video Lessons, Quizzes & Decision Prompts (owner curriculum); California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 6, Blind Spots",
      "choices": [
        {
          "label": "Keep the car straight and look over your left shoulder",
          "safe": true,
          "feedback": "A quick head check shows what mirrors miss. Wait until the blind spot is clear."
        },
        {
          "label": "Check only the mirror and move over",
          "safe": false,
          "feedback": "Mirrors do not show every blind spot. Look over your shoulder first."
        },
        {
          "label": "Turn your body and the wheel to get a better look",
          "safe": false,
          "feedback": "Turning the wheel can drift you into the next lane. Turn only your head."
        }
      ]
    },
    "keySegment": {
      "start": 13,
      "end": 23
    },
    "recall": {
      "front": "Can your mirrors show your blind spots?",
      "back": "No. Turn your head and look over your shoulder.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 6, Blind Spots, p. 45"
    },
    "glossary": "glossary-blind-spot"
  },
  "blind-curve": {
    "topicId": "speed-and-visibility",
    "safety": 0.8,
    "similar": {
      "question": "On a narrow street with parked cars, you can’t see around the curve ahead. What is safest?",
      "options": [
        "Keep your speed and move toward the center",
        "Slow down, stay right, and let oncoming cars clear",
        "Speed up to get through before anyone comes"
      ],
      "answer": 1,
      "explanation": "Drive no faster than is safe for what you can see, and take one hazard at a time.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 6, Choose Between Hazards, p. 52"
    },
    "harder": {
      "question": "You cannot see whether traffic is coming around a curve ahead. Should you pass the slow car in front of you?",
      "options": [
        "Yes, if you speed up quickly to pass",
        "No, not until you can see far enough ahead",
        "Yes, if the car ahead is going very slow"
      ],
      "answer": 1,
      "explanation": "Do not pass when you cannot see if traffic is approaching. To pass safely, a hill or curve should be at least one-third of a mile ahead.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 4, Passing"
    },
    "activity": {
      "id": "decision-15",
      "prompt": "In daylight, a blind curve ahead is narrowed by parked cars on both sides.",
      "draft": true,
      "source": "Decision prompt adapted from Lane — California Driver Education: Video Lessons, Quizzes & Decision Prompts (owner curriculum); California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 6, Manage Your Speed",
      "choices": [
        {
          "label": "Slow early and keep to the right side of your lane",
          "safe": true,
          "feedback": "Slowing early leaves time to see an oncoming car and wait for it."
        },
        {
          "label": "Speed up to get through the curve quickly",
          "safe": false,
          "feedback": "Less time means less chance to react to what the curve hides."
        },
        {
          "label": "Drive in the center of the road for more room",
          "safe": false,
          "feedback": "The center puts you in the path of oncoming traffic you cannot see yet."
        }
      ]
    },
    "keySegment": {
      "start": 0,
      "end": 11
    },
    "recall": {
      "front": "What does California’s Basic Speed Law say?",
      "back": "Never drive faster than is safe for current conditions, even below the posted limit.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 6, Manage Your Speed, p. 52"
    },
    "glossary": "glossary-lane-positioning"
  },
  "blind-bend": {
    "topicId": "speed-and-visibility",
    "safety": 0.8,
    "similar": {
      "question": "A pedestrian may be crossing just past the bend. What do you do?",
      "options": [
        "Honk so they hurry across",
        "Slow down or stop so they can finish crossing",
        "Keep your speed; they will see you"
      ],
      "answer": 1,
      "explanation": "Use caution, and reduce your speed or stop so the pedestrian can safely finish crossing.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 5, Pedestrians, p. 32"
    },
    "harder": {
      "question": "What is the speed limit at a blind intersection?",
      "options": [
        "25 mph",
        "15 mph",
        "10 mph"
      ],
      "answer": 1,
      "explanation": "An intersection is blind if it has no stop signs and your view is blocked. The limit is 15 mph; move slowly forward until you can see.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 5, Blind Intersections"
    },
    "activity": {
      "id": "decision-16",
      "prompt": "On a narrow two-way street, parked cars at a blind bend may hide a pedestrian about to cross.",
      "draft": true,
      "source": "Decision prompt adapted from Lane — California Driver Education: Video Lessons, Quizzes & Decision Prompts (owner curriculum); California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 6, Manage Your Speed; Section 5, Pedestrians",
      "choices": [
        {
          "label": "Slow down, stay right, and go only when the path is clear",
          "safe": true,
          "feedback": "You keep room to stop within what you can see."
        },
        {
          "label": "Move left toward the center to see past parked cars",
          "safe": false,
          "feedback": "Drifting left risks oncoming traffic. Slow or stop until you can see."
        }
      ]
    },
    "keySegment": {
      "start": 2,
      "end": 25
    },
    "recall": {
      "front": "Speed limit at a blind intersection?",
      "back": "15 mph.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 5, Blind Intersections, p. 39"
    },
    "glossary": "glossary-pedestrian"
  },
  "merging-trailer": {
    "topicId": "sharing-the-road",
    "safety": 0.8,
    "similar": {
      "question": "A large truck is in the lane next to you on the freeway. What should you avoid?",
      "options": [
        "Staying beside it longer than needed",
        "Passing it on the left side",
        "Leaving space in front of it"
      ],
      "answer": 0,
      "explanation": "Driving alongside a large vehicle keeps you in its blind spot. Pass on the left, then move ahead of it.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 5, Maneuvering (large vehicles)"
    },
    "harder": {
      "question": "Why should you not move in front of a large truck and then slow down?",
      "options": [
        "It makes the truck change lanes",
        "Large vehicles take longer to stop",
        "Trucks cannot use their mirrors"
      ],
      "answer": 1,
      "explanation": "A large vehicle at 55 mph can need up to 400 feet to stop, more than a car. It may not stop in time.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 5, Braking (large vehicles)"
    },
    "activity": {
      "id": "decision-17",
      "prompt": "A trailer-towing vehicle signals and begins moving into your lane ahead.",
      "draft": true,
      "source": "Decision prompt adapted from Lane — California Driver Education: Video Lessons, Quizzes & Decision Prompts (owner curriculum); California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 6, Know What Is at Your Side",
      "choices": [
        {
          "label": "Ease off the accelerator and create a gap",
          "safe": true,
          "feedback": "Making space lets the merge finish safely. Then rebuild at least a three-second gap."
        },
        {
          "label": "Speed up so the trailer merges behind you",
          "safe": false,
          "feedback": "Closing the gap leaves the towing vehicle nowhere to go. Make space instead."
        }
      ]
    },
    "keySegment": {
      "start": 14,
      "end": 25
    },
    "recall": {
      "front": "A car merges in too close ahead. What is your first move?",
      "back": "Take your foot off the accelerator to open space.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 6, Tailgating, p. 44"
    },
    "glossary": "glossary-no-zone"
  },
  "stopping-distance": {
    "topicId": "space-and-speed",
    "safety": 0.8,
    "similar": {
      "question": "What following interval does the handbook say to use?",
      "options": [
        "One second",
        "Two seconds",
        "Three seconds"
      ],
      "answer": 2,
      "explanation": "Use the three-second rule to keep a safe following distance.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 6, Tailgating, p. 44"
    },
    "harder": {
      "question": "The road is covered in packed snow. How should your speed change?",
      "options": [
        "Reduce it by about 5 mph",
        "Reduce it by half",
        "Keep the posted speed"
      ],
      "answer": 1,
      "explanation": "On packed snow, reduce your speed by half. On ice, go no faster than 5 mph.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 6, Slippery Roads"
    },
    "activity": {
      "id": "decision-18",
      "prompt": "On a dry road, a car merges closely in front of you near a marked crosswalk.",
      "draft": true,
      "source": "Decision prompt adapted from Lane — California Driver Education: Video Lessons, Quizzes & Decision Prompts (owner curriculum); California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 6, Tailgating",
      "choices": [
        {
          "label": "Lift off the accelerator and rebuild a three-second gap",
          "safe": true,
          "feedback": "Added space gives you time to react if the car ahead stops for the crosswalk."
        },
        {
          "label": "Keep your speed and let the gap open by itself",
          "safe": false,
          "feedback": "You are now following too closely. Ease off to create space."
        }
      ]
    },
    "keySegment": {
      "start": 1,
      "end": 11
    },
    "recall": {
      "front": "The road is wet. How should your speed change?",
      "back": "Reduce it by 5 to 10 mph.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 6, Slippery Roads, p. 48"
    },
    "glossary": "glossary-tailgating"
  },
  "three-second-check": {
    "topicId": "space-and-speed",
    "safety": 0.8,
    "similar": {
      "question": "When should you leave more than three seconds of space?",
      "options": [
        "When someone is tailgating you",
        "Only when the road is empty",
        "Only on streets under 25 mph"
      ],
      "answer": 0,
      "explanation": "Create more space ahead when a tailgater is behind you, and when following motorcyclists over metal surfaces or gravel.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 6, Tailgating, p. 44"
    },
    "harder": {
      "question": "A tailgater is close behind you. What does the handbook recommend?",
      "options": [
        "Tap your brakes hard to warn them",
        "Keep your speed, then merge right when safe",
        "Speed up to get away from them"
      ],
      "answer": 1,
      "explanation": "Maintain your course and speed, and when it is safe, merge right so the tailgater can pass.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 6, Tailgating"
    },
    "keySegment": {
      "start": 12,
      "end": 21
    },
    "recall": {
      "front": "How do you check a three-second following gap?",
      "back": "Count from when the car ahead passes a fixed point until you reach it.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 6, Tailgating, p. 44"
    },
    "glossary": "glossary-three-second-rule"
  },
  "yellow-light": {
    "topicId": "signals",
    "safety": 0.9,
    "similar": {
      "question": "What does a flashing yellow traffic light mean?",
      "options": [
        "Stop and wait for green",
        "Slow down and proceed with caution",
        "The light is broken; treat it as a STOP sign"
      ],
      "answer": 1,
      "explanation": "A flashing yellow light is a warning: slow down and be alert. You do not need to stop.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 5, Flashing Yellow Light"
    },
    "harder": {
      "question": "You are already in the intersection, turning, when your yellow arrow appears. What do you do?",
      "options": [
        "Stop where you are",
        "Cautiously complete your turn",
        "Back up behind the limit line"
      ],
      "answer": 1,
      "explanation": "A yellow arrow means the protected turn is ending. If you are already in the intersection, cautiously complete the turn.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 5, Yellow Arrow"
    },
    "recall": {
      "front": "What does a solid yellow light mean?",
      "back": "The light is about to turn red. Stop if you can do so safely.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 5, Solid Yellow Light, p. 24"
    }
  },
  "roundabout": {
    "topicId": "right-of-way",
    "safety": 0.9,
    "similar": {
      "question": "Which direction does traffic travel in a California roundabout?",
      "options": [
        "Counterclockwise",
        "Clockwise",
        "Either direction"
      ],
      "answer": 0,
      "explanation": "Travel counterclockwise. Do not stop or pass inside the roundabout.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 5, Roundabouts"
    },
    "harder": {
      "question": "In a two-lane roundabout, you plan to turn right. Which lane should you use?",
      "options": [
        "The left lane",
        "The right lane, and exit in the right lane",
        "Either lane, then cut across at the exit"
      ],
      "answer": 1,
      "explanation": "To turn right, choose the right lane and exit in the right lane.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 5, Roundabouts"
    },
    "recall": {
      "front": "Which way does traffic travel in a roundabout?",
      "back": "Counterclockwise. Yield to all traffic already in it.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 5, Roundabouts, p. 31"
    }
  },
  "four-way-stop": {
    "topicId": "right-of-way",
    "safety": 0.9,
    "similar": {
      "question": "At a four-way stop, a pedestrian on your right steps into the crosswalk as you stop. Who goes first?",
      "options": [
        "The pedestrian",
        "You, because you are in a vehicle",
        "Whoever moves first"
      ],
      "answer": 0,
      "explanation": "Pedestrians have the right-of-way in crosswalks, and arrivals at the same time yield to the road user on the right.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 5, Intersections; Pedestrians"
    },
    "harder": {
      "question": "You stopped first at a four-way stop. What do you do before proceeding?",
      "options": [
        "Go immediately so you keep your turn",
        "Wait for another driver to wave you on",
        "Check traffic in all directions, then go when safe"
      ],
      "answer": 2,
      "explanation": "After a full stop, check traffic in all directions before proceeding.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 5, STOP Sign"
    },
    "recall": {
      "front": "You stopped first at a four-way stop. Who goes first?",
      "back": "You do, once it is safe.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 5, Intersections, p. 30"
    },
    "glossary": "glossary-yield-line"
  },
  "following-distance": {
    "topicId": "space-and-speed",
    "safety": 0.8,
    "similar": {
      "question": "When should you leave more than three seconds of space?",
      "options": [
        "Following a motorcycle over metal or gravel",
        "On a dry, empty road in daylight",
        "Whenever you are at a red light"
      ],
      "answer": 0,
      "explanation": "Leave extra space when following motorcyclists on metal surfaces or gravel, and when a tailgater is behind you.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 6, Tailgating"
    },
    "harder": {
      "question": "How do you check a three-second following gap?",
      "options": [
        "Count car lengths to the car ahead",
        "Watch your speedometer for three seconds",
        "Count from a fixed point the car ahead passes"
      ],
      "answer": 2,
      "explanation": "Pick a fixed point such as a sign and count as the car ahead passes it. Reaching it before three seconds means you are too close.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 6, Tailgating"
    },
    "recall": {
      "front": "Rain, night, or a tailgater behind you: how much following space?",
      "back": "More than three seconds.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 6, Tailgating, p. 44"
    },
    "glossary": "glossary-three-second-rule"
  },
  "school-bus": {
    "topicId": "sharing-the-road",
    "safety": 1,
    "similar": {
      "question": "A school bus ahead starts flashing yellow lights. What are they warning you to do?",
      "options": [
        "Pass quickly before it stops",
        "Slow down and prepare to stop",
        "Nothing yet; only red lights matter"
      ],
      "answer": 1,
      "explanation": "Flashing yellow lights warn you to slow down and prepare to stop.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 5, Around Children"
    },
    "harder": {
      "question": "A school bus with flashing red lights is stopped on the other side of a divided highway. Must you stop?",
      "options": [
        "Yes, every vehicle must stop",
        "No, you do not need to stop",
        "Only if children are visible"
      ],
      "answer": 1,
      "explanation": "You do not need to stop for a bus on the other side of a divided or multilane highway. Watch for children anyway.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 5, Around Children"
    },
    "recall": {
      "front": "A school bus on a two-lane road flashes red lights. What do you do?",
      "back": "Stop, and stay stopped until the red lights stop flashing.",
      "draft": true,
      "source": "California Quick Reference Driver's Handbook (DL 600 X, 6/2025), Section 5, Around Children (stopped school buses), pp. 38–39"
    }
  }
};

export const learningFor = (lessonId: string): LessonLearning | undefined => LEARNING[lessonId];
export const topicOf = (lessonId: string) => LEARNING[lessonId]?.topicId ?? lessonId;
