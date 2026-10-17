import type { PermitBank } from './score';

// Supplied by the Lane team from "CAC Permit Test Final Quiz Bank.pdf"; sourcePage points into that PDF.
// This is a practice bank, not an official DMV test. Questions 2 and 18 use redrawn sign artwork
// because the PDF only had text placeholders.
export const PERMIT_BANK: PermitBank = {
  title: 'California practice test',
  target: 0.8,
  topics: {
    signs: 'Signs & road markings',
    safe: 'Safe driving & speed',
    lanes: 'Turns, lanes & passing',
    yield: 'Right-of-way & pedestrians',
    parking: 'Parking & curbs',
    duties: 'Driver responsibilities',
  },
  questions: [
    {
      id: 'ca-001', topicId: 'safe', conceptId: 'following-distance', sourcePage: 1,
      prompt: 'What is the recommended minimum following distance behind a vehicle?',
      choices: [
        { id: 'a', text: '50 feet' },
        { id: 'b', text: 'one car length for every 10 mph' },
        { id: 'c', text: '3 seconds' },
      ],
      correctChoiceId: 'c',
    },
    {
      id: 'ca-002', topicId: 'signs', conceptId: 'crossroads', sourcePage: 1,
      prompt: 'What does this sign mean?',
      image: { src: '/images/signs/crossroads.svg', alt: 'Yellow diamond with a black cross-shaped symbol.' },
      choices: [
        { id: 'a', text: 'There are no intersections ahead for a long time.' },
        { id: 'b', text: 'You are approaching crossroads ahead.' },
        { id: 'c', text: 'Turn right soon.' },
      ],
      correctChoiceId: 'b',
    },
    {
      id: 'ca-003', topicId: 'signs', conceptId: 'shared-lane', sourcePage: 1,
      prompt: 'A sign depicting a bicycle with two arrows above it indicates:',
      choices: [
        { id: 'a', text: 'bicycle crossing just ahead' },
        { id: 'b', text: 'lane reserved for bicycles only' },
        { id: 'c', text: 'shared lane for bicycles and vehicles' },
      ],
      correctChoiceId: 'c',
    },
    {
      id: 'ca-004', topicId: 'duties', conceptId: 'seatbelts', sourcePage: 2,
      prompt: 'Who is required to wear a seatbelt in a vehicle in California?',
      choices: [
        { id: 'a', text: 'every occupant of the vehicle' },
        { id: 'b', text: 'only children under the age of 12' },
        { id: 'c', text: 'only the driver and front seat passenger' },
      ],
      correctChoiceId: 'a',
    },
    {
      id: 'ca-005', topicId: 'lanes', conceptId: 'being-passed', sourcePage: 2,
      prompt: 'What action should drivers take when their vehicle is being passed?',
      choices: [
        { id: 'a', text: 'maintain lane position and speed' },
        { id: 'b', text: 'slow down suddenly to make room' },
        { id: 'c', text: 'speed up to make the pass more difficult for the other vehicle' },
      ],
      correctChoiceId: 'a',
    },
    {
      id: 'ca-006', topicId: 'yield', conceptId: 'roundabouts', sourcePage: 2,
      prompt: 'In a roundabout, drivers must:',
      choices: [
        { id: 'a', text: 'stop inside the roundabout to let other cars enter' },
        { id: 'b', text: 'travel counterclockwise and yield to traffic already in it' },
        { id: 'c', text: 'speed up to merge quickly with the circling traffic' },
      ],
      correctChoiceId: 'b',
    },
    {
      id: 'ca-007', topicId: 'signs', conceptId: 'yellow-barrier', sourcePage: 2,
      prompt: 'What do two sets of double yellow lines that are spaced two feet or more apart indicate?',
      choices: [
        { id: 'a', text: 'lanes of traffic moving in the opposite direction' },
        { id: 'b', text: 'a barrier not to be crossed' },
        { id: 'c', text: 'carpool/high-Occupancy (HOV) lane' },
      ],
      correctChoiceId: 'b',
    },
    {
      id: 'ca-008', topicId: 'duties', conceptId: 'police-evasion', sourcePage: 3,
      prompt: 'If someone is seriously injured while a driver intentionally tries to evade police, what could the consequence be?',
      choices: [
        { id: 'a', text: 'suspension of license for one year' },
        { id: 'b', text: '$250 fine and probation' },
        { id: 'c', text: 'sentence of up to 7 years in a state prison' },
      ],
      correctChoiceId: 'c',
    },
    {
      id: 'ca-009', topicId: 'safe', conceptId: 'visibility', sourcePage: 3,
      prompt: 'What lights should you turn on if dust or smoke is limiting your visibility?',
      choices: [
        { id: 'a', text: 'Use your headlights to help you see and be seen.' },
        { id: 'b', text: 'Use your parking lights only.' },
        { id: 'c', text: 'Turn on emergency flashers and stop in place.' },
      ],
      correctChoiceId: 'a',
    },
    {
      id: 'ca-010', topicId: 'lanes', conceptId: 'one-way-turns', sourcePage: 3,
      prompt: 'Where should you position your vehicle when making a left turn from a one-way street to another one-way street?',
      choices: [
        { id: 'a', text: 'from any available traffic lane' },
        { id: 'b', text: 'from the lane closest to the left curb' },
        { id: 'c', text: 'from the far-right lane' },
      ],
      correctChoiceId: 'b',
    },
    {
      id: 'ca-011', topicId: 'lanes', conceptId: 'paved-passing', sourcePage: 3,
      prompt: 'When is it legal to drive off the paved roadway to pass another vehicle?',
      choices: [
        { id: 'a', text: 'under no circumstances' },
        { id: 'b', text: 'if the shoulder is wide enough to accommodate your vehicle' },
        { id: 'c', text: 'if the vehicle ahead of you is turning left' },
      ],
      correctChoiceId: 'a',
    },
    {
      id: 'ca-012', topicId: 'duties', conceptId: 'test-refusal', sourcePage: 4,
      prompt: 'If you refuse a blood or urine test requested by law enforcement, what can the DMV do?',
      choices: [
        { id: 'a', text: 'suspend or revoke your driving privilege' },
        { id: 'b', text: 'nothing, as test refusal is your right' },
        { id: 'c', text: 'only issue a warning' },
      ],
      correctChoiceId: 'a',
    },
    {
      id: 'ca-013', topicId: 'duties', conceptId: 'license-class', sourcePage: 4,
      prompt: "What vehicles are covered by a non-commercial Class C driver's license?",
      choices: [
        { id: 'a', text: 'standard passenger cars' },
        { id: 'b', text: 'commercial vehicles' },
        { id: 'c', text: 'buses' },
      ],
      correctChoiceId: 'a',
    },
    {
      id: 'ca-014', topicId: 'parking', conceptId: 'white-curbs', sourcePage: 4,
      prompt: 'What does a white-painted curb mean?',
      choices: [
        { id: 'a', text: 'loading or unloading passengers only' },
        { id: 'b', text: 'no stopping, standing, or parking' },
        { id: 'c', text: 'loading zone for freight only' },
      ],
      correctChoiceId: 'a',
    },
    {
      id: 'ca-015', topicId: 'duties', conceptId: 'child-supervision', sourcePage: 5,
      prompt: 'It is against the law to leave a child six years old or younger unattended in a vehicle unless:',
      choices: [
        { id: 'a', text: 'A person at least 12 years old is supervising them.' },
        { id: 'b', text: 'They are asleep and the doors are locked.' },
        { id: 'c', text: 'The windows are partly open and it is cool out.' },
      ],
      correctChoiceId: 'a',
    },
    {
      id: 'ca-016', topicId: 'duties', conceptId: 'insurance', sourcePage: 5,
      prompt: "If you're involved in a collision without proper insurance coverage, your driving privilege can be suspended for up to how many years?",
      choices: [
        { id: 'a', text: '3 years' },
        { id: 'b', text: '1 year' },
        { id: 'c', text: '4 years' },
      ],
      correctChoiceId: 'c',
    },
    {
      id: 'ca-017', topicId: 'lanes', conceptId: 'bicycle-clearance', sourcePage: 5,
      prompt: 'When passing a bicyclist in the travel lane, what should you do if you cannot change lanes?',
      choices: [
        { id: 'a', text: 'pass with at least three feet clearance when safe' },
        { id: 'b', text: 'honk to alert the bicyclist of your presence' },
        { id: 'c', text: 'speed past the bicyclist quickly to minimize time beside them' },
      ],
      correctChoiceId: 'a',
    },
    {
      id: 'ca-018', topicId: 'signs', conceptId: 'two-way', sourcePage: 5,
      prompt: 'What does this sign mean?',
      image: { src: '/images/signs/two-way.svg', alt: 'Yellow diamond with two vertical black arrows pointing in opposite directions.' },
      choices: [
        { id: 'a', text: 'This is a two-way street.' },
        { id: 'b', text: 'The speed limit will soon increase.' },
        { id: 'c', text: 'This is a one-way street.' },
      ],
      correctChoiceId: 'a',
    },
    {
      id: 'ca-019', topicId: 'safe', conceptId: 'truck-blind-spots', sourcePage: 6,
      prompt: 'When driving near a large vehicle or truck, why is it important not to follow too closely?',
      choices: [
        { id: 'a', text: 'They can stop more quickly than cars can.' },
        { id: 'b', text: 'They have big blind spots and need more room to stop.' },
        { id: 'c', text: 'Their drivers can always see cars behind them.' },
      ],
      correctChoiceId: 'b',
    },
    {
      id: 'ca-020', topicId: 'safe', conceptId: 'scanning', sourcePage: 6,
      prompt: 'When scanning your surroundings, how far ahead should you be looking?',
      choices: [
        { id: 'a', text: 'immediately in front of your vehicle only' },
        { id: 'b', text: 'only to the sides of your vehicle' },
        { id: 'c', text: 'at least 10 seconds ahead of your vehicle' },
      ],
      correctChoiceId: 'c',
    },
    {
      id: 'ca-021', topicId: 'yield', conceptId: 'blind-pedestrians', sourcePage: 6,
      prompt: 'When approaching a pedestrian using a guide dog or white cane, which of the following is true?',
      choices: [
        { id: 'a', text: 'They have the right-of-way at all times.' },
        { id: 'b', text: 'You may go first once they reach the curb.' },
        { id: 'c', text: 'A short honk helps them know you are there.' },
      ],
      correctChoiceId: 'a',
    },
    {
      id: 'ca-022', topicId: 'duties', conceptId: 'phone-use', sourcePage: 7,
      prompt: 'What is the law on using handheld devices while driving in California?',
      choices: [
        { id: 'a', text: 'Handheld devices are banned for all drivers.' },
        { id: 'b', text: 'Texting is allowed for drivers over the age of 25.' },
        { id: 'c', text: 'Handheld devices are banned for teen drivers only.' },
      ],
      correctChoiceId: 'a',
    },
    {
      id: 'ca-023', topicId: 'lanes', conceptId: 'u-turn', sourcePage: 7,
      prompt: 'What is a U-turn?',
      choices: [
        { id: 'a', text: 'changing lanes inside an intersection' },
        { id: 'b', text: 'making three right turns around a block' },
        { id: 'c', text: 'turning around to go the opposite direction' },
      ],
      correctChoiceId: 'c',
    },
    {
      id: 'ca-024', topicId: 'duties', conceptId: 'collision-reporting', sourcePage: 7,
      prompt: 'If a driver is involved in a collision causing death or injury, they must report the collision to:',
      choices: [
        { id: 'a', text: 'only their own insurance company' },
        { id: 'b', text: 'both DMV and the local police department' },
        { id: 'c', text: 'only the local police department' },
      ],
      correctChoiceId: 'b',
    },
    {
      id: 'ca-025', topicId: 'yield', conceptId: 'crossing-guards', sourcePage: 7,
      prompt: 'When must you follow the instructions given by a school crossing guard?',
      choices: [
        { id: 'a', text: 'only when children are in the crosswalk' },
        { id: 'b', text: 'only during posted school hours' },
        { id: 'c', text: 'at all times when they are directing traffic' },
      ],
      correctChoiceId: 'c',
    },
    {
      id: 'ca-026', topicId: 'duties', conceptId: 'collision-reporting', sourcePage: 8,
      prompt: 'Under what circumstances must you submit a California SR-1 accident report form to the DMV?',
      choices: [
        { id: 'a', text: 'when you update your vehicle insurance provider' },
        { id: 'b', text: 'if you are in an accident that causes injury or death' },
        { id: 'c', text: 'when your registration renewal is overdue' },
      ],
      correctChoiceId: 'b',
    },
    {
      id: 'ca-027', topicId: 'lanes', conceptId: 'signaling', sourcePage: 8,
      prompt: 'How far before a turn or lane change must you signal your intention?',
      choices: [
        { id: 'a', text: 'at least 100 feet before the turn' },
        { id: 'b', text: 'at least 300 feet before the turn' },
        { id: 'c', text: 'at least 50 feet before the turn' },
      ],
      correctChoiceId: 'a',
    },
    {
      id: 'ca-028', topicId: 'lanes', conceptId: 'bicycle-lane-turn', sourcePage: 8,
      prompt: 'When are you allowed to drive in a bicycle lane in California?',
      choices: [
        { id: 'a', text: 'at any time when driving slower than 25 mph' },
        { id: 'b', text: 'on one-way streets' },
        { id: 'c', text: 'up to 200 feet before making a right turn' },
      ],
      correctChoiceId: 'c',
    },
    {
      id: 'ca-029', topicId: 'duties', conceptId: 'alcohol', sourcePage: 8,
      prompt: 'For which of these people would it be legal to operate a vehicle with a blood alcohol concentration (BAC) of 0.04?',
      choices: [
        { id: 'a', text: 'persons under 21 years of age' },
        { id: 'b', text: 'persons 21 years of age or older' },
        { id: 'c', text: 'persons on a DUI probation' },
      ],
      correctChoiceId: 'b',
    },
    {
      id: 'ca-030', topicId: 'safe', conceptId: 'truck-blind-spots', sourcePage: 9,
      prompt: 'Which statement accurately describes large commercial trucks?',
      choices: [
        { id: 'a', text: 'Their braking systems are more responsive than standard cars.' },
        { id: 'b', text: 'They have extensive blind spots, which can obscure other vehicles from their view.' },
        { id: 'c', text: 'Their wide turning radius makes them ideal for city driving.' },
      ],
      correctChoiceId: 'b',
    },
    {
      id: 'ca-031', topicId: 'duties', conceptId: 'collision-reporting', sourcePage: 9,
      prompt: 'How many days do you have to report a collision causing more than $1,000 in damage to DMV?',
      choices: [
        { id: 'a', text: '10 days' },
        { id: 'b', text: '21 days' },
        { id: 'c', text: '7 days' },
      ],
      correctChoiceId: 'a',
    },
    {
      id: 'ca-032', topicId: 'safe', conceptId: 'school-speed', sourcePage: 9,
      prompt: 'What is the speed limit when driving within 500 feet of a school while children are outside?',
      choices: [
        { id: 'a', text: '35 mph' },
        { id: 'b', text: '25 mph' },
        { id: 'c', text: '15 mph' },
      ],
      correctChoiceId: 'b',
    },
    {
      id: 'ca-033', topicId: 'parking', conceptId: 'accessible-parking', sourcePage: 10,
      prompt: 'When is it legal to park in a crosshatched or diagonally striped space next to a blue curb?',
      choices: [
        { id: 'a', text: 'Only when no designated disabled spaces are available.' },
        { id: 'b', text: 'If the crosshatched area is marked for loading.' },
        { id: 'c', text: 'Never — these areas are off-limits for parking at all times.' },
      ],
      correctChoiceId: 'c',
    },
    {
      id: 'ca-034', topicId: 'safe', conceptId: 'railroad-speed', sourcePage: 10,
      prompt: "You're approaching an uncontrolled railroad crossing. If you're within 100 feet and have limited visibility (less than 400 feet in both directions), what's the maximum safe speed?",
      choices: [
        { id: 'a', text: '15 mph' },
        { id: 'b', text: '10 mph' },
        { id: 'c', text: '25 mph' },
      ],
      correctChoiceId: 'a',
    },
    {
      id: 'ca-035', topicId: 'safe', conceptId: 'off-pavement', sourcePage: 10,
      prompt: 'What is the correct response if your vehicle’s wheels drift off the pavement?',
      choices: [
        { id: 'a', text: 'Accelerate quickly to rejoin the flow of traffic.' },
        { id: 'b', text: 'Brake hard and steer back onto the road right away.' },
        { id: 'c', text: 'Hold the wheel firmly, ease off the gas, and brake gently.' },
      ],
      correctChoiceId: 'c',
    },
    {
      id: 'ca-036', topicId: 'yield', conceptId: 'emergency-vehicles', sourcePage: 10,
      prompt: 'How should you react to an emergency vehicle displaying flashing lights and sounding a siren?',
      choices: [
        { id: 'a', text: 'speed up so you can clear the road ahead of it' },
        { id: 'b', text: 'move over to allow a clear path and stop if necessary' },
        { id: 'c', text: 'follow closely behind it to get through traffic' },
      ],
      correctChoiceId: 'b',
    },
    {
      id: 'ca-037', topicId: 'lanes', conceptId: 'bicycle-lane-turn', sourcePage: 11,
      prompt: 'When is it okay to drive in a bicycle lane?',
      choices: [
        { id: 'a', text: 'when turning right within 200 feet of an intersection' },
        { id: 'b', text: 'when the bicycle lane is unoccupied' },
        { id: 'c', text: 'at all times, regardless of the situation.' },
      ],
      correctChoiceId: 'a',
    },
    {
      id: 'ca-038', topicId: 'lanes', conceptId: 'paved-passing', sourcePage: 11,
      prompt: 'Under NO circumstances are you allowed to:',
      choices: [
        { id: 'a', text: 'pass a vehicle on the left' },
        { id: 'b', text: 'leave the roadway to pass another car' },
        { id: 'c', text: 'leave the roadway to avoid a serious collision' },
      ],
      correctChoiceId: 'b',
    },
    {
      id: 'ca-039', topicId: 'yield', conceptId: 'school-bus', sourcePage: 11,
      prompt: 'Not stopping for a school bus that is unloading children can result in:',
      choices: [
        { id: 'a', text: 'only a written warning for a first offense' },
        { id: 'b', text: 'a fine up to $1,000 and a possible license suspension' },
        { id: 'c', text: 'a fine of $100 with no other penalty' },
      ],
      correctChoiceId: 'b',
    },
    {
      id: 'ca-040', topicId: 'duties', conceptId: 'registration', sourcePage: 12,
      prompt: 'After becoming a resident or getting a job in California, you have how many days to register your out-of-state vehicle?',
      choices: [
        { id: 'a', text: '30 days' },
        { id: 'b', text: '10 days' },
        { id: 'c', text: '20 days' },
      ],
      correctChoiceId: 'c',
    },
    {
      id: 'ca-041', topicId: 'lanes', conceptId: 'red-light-turn', sourcePage: 12,
      prompt: 'A left turn on a red light is:',
      choices: [
        { id: 'a', text: 'never allowed in California at all' },
        { id: 'b', text: 'allowed onto any one-way street after stopping' },
        { id: 'c', text: 'allowed only from one one-way street onto another' },
      ],
      correctChoiceId: 'c',
    },
    {
      id: 'ca-042', topicId: 'duties', conceptId: 'work-zone', sourcePage: 12,
      prompt: 'When are fines for traffic violations in a work zone doubled?',
      choices: [
        { id: 'a', text: 'only during peak hours' },
        { id: 'b', text: 'if the violation results in a traffic jam' },
        { id: 'c', text: 'when workers are present' },
      ],
      correctChoiceId: 'c',
    },
    {
      id: 'ca-043', topicId: 'yield', conceptId: 'wheelchair-pedestrians', sourcePage: 12,
      prompt: 'What is the correct response when someone in a motorized wheelchair is crossing in front of you at an intersection?',
      choices: [
        { id: 'a', text: 'Carefully drive around them if there’s enough room.' },
        { id: 'b', text: 'Wait behind the crosswalk until the person has fully cleared your vehicle’s path.' },
        { id: 'c', text: 'Proceed slowly as long as the person is not directly in your lane.' },
      ],
      correctChoiceId: 'b',
    },
    {
      id: 'ca-044', topicId: 'duties', conceptId: 'collision-reporting', sourcePage: 13,
      prompt: 'Under what condition is it necessary to file a Report of Traffic Accident Occurring in California (SR-1)?',
      choices: [
        { id: 'a', text: 'You were involved in a collision with an injury.' },
        { id: 'b', text: "Your driver's license has expired." },
        { id: 'c', text: 'Your car failed a routine smog inspection.' },
      ],
      correctChoiceId: 'a',
    },
    {
      id: 'ca-045', topicId: 'signs', conceptId: 'hazardous-materials', sourcePage: 13,
      prompt: 'What does a diamond-shaped sign on a truck indicate?',
      choices: [
        { id: 'a', text: 'The truck has priority over other vehicles.' },
        { id: 'b', text: 'The truck is oversized.' },
        { id: 'c', text: 'The truck is carrying hazardous materials.' },
      ],
      correctChoiceId: 'c',
    },
    {
      id: 'ca-046', topicId: 'lanes', conceptId: 'right-passing', sourcePage: 13,
      prompt: 'When is it legal to pass another vehicle on the right?',
      choices: [
        { id: 'a', text: 'on a narrow two-lane road with no traffic' },
        { id: 'b', text: 'whenever the car ahead is under the speed limit' },
        { id: 'c', text: 'when the car ahead is turning left and there is room' },
      ],
      correctChoiceId: 'c',
    },
  ],
};
