'use client';

import { useId, useRef, useState } from 'react';
import { motion, useMotionValueEvent, useReducedMotion, useScroll } from 'framer-motion';
import { ArrowDown, Bluetooth, Radio, Server, ShieldCheck, Smartphone, Thermometer, Cpu } from 'lucide-react';

export const JOURNEY = [
  { title: 'Start with the hive.', tag: '01 / FIELD', icon: Thermometer, detail: 'An instrumented bee box captures temperature, humidity and weight. Each packet carries a device identity, timestamp and source.', signal: 'ESP32 · temperature · humidity · load cell', note: 'Missing or stale sensor readings must stay visible.' },
  { title: 'A familiar connection.', tag: '02 / BLUETOOTH', icon: Bluetooth, detail: 'A nearby phone can collect readings over Bluetooth LE. A cooperative gateway provides an alternative where a phone is not always present.', signal: 'Bee box → BLE phone / gateway', note: 'BLE is a local link; the phone or gateway still needs an uplink.' },
  { title: 'Small packets. Long journeys.', tag: '03 / MQTT', icon: Radio, detail: 'The gateway publishes device packets to a cluster MQTT topic. The bridge validates credentials, handles duplicates and forwards readings for storage.', signal: 'honeychain / cluster / hive / telemetry', note: 'Queue and retry when the rural connection drops.' },
  { title: 'Turn readings into context.', tag: '04 / INTELLIGENCE', icon: Server, detail: 'The server keeps private farmer records and sensor history. Health rules, disease-image assessment and yield estimates support an operator’s decisions.', signal: 'PostgreSQL · health assessment · advisory', note: 'AI indicators support inspection; they do not prove honey purity.' },
  { title: 'Record who said what.', tag: '05 / BLOCKCHAIN', icon: ShieldCheck, detail: 'Harvest, laboratory, custody, packaging and recall events are committed to a shared registry. Evidence files stay off-chain and are checked against their hashes.', signal: 'Signed event → relayer → EVM registry', note: 'A separate relayer pays gas. Farmers approve records with an enrolled signing wallet.' },
  { title: 'One jar. A visible journey.', tag: '06 / CONSUMER', icon: Smartphone, detail: 'A serialized QR connects a jar to the recorded batch and its evidence. The consumer sees what matches, what is pending, and any recall warning.', signal: 'Label → batch → lab evidence → recall', note: 'A copied printed QR is still possible; scan alerts are advisory.' },
] as const;

export function HiveScene({ stage = 0, compact = false }: { stage?: number; compact?: boolean }) {
  const reduce = useReducedMotion();
  const sceneId = useId();
  return <div className={compact ? 'hive-scene hive-scene-compact' : 'hive-scene'}>
    <svg viewBox="0 0 760 580" role="img" aria-label="Illustrated smart bee box connected to a phone, MQTT server and blockchain registry">
      <defs>
        <pattern id={sceneId + '-wood'} width="8" height="22" patternUnits="userSpaceOnUse"><path d="M0 20H8" stroke="#815126" strokeWidth="1" opacity=".28" /></pattern>
        <pattern id={sceneId + '-solar'} width="16" height="16" patternUnits="userSpaceOnUse"><path d="M0 0H16V16" stroke="#7a9fbd" strokeWidth=".6" opacity=".5" /></pattern>
      </defs>
      <ellipse cx="352" cy="492" rx="210" ry="25" fill="var(--scene-shadow)" />
      <g opacity=".32" stroke="var(--surface-border)" fill="none">
        <path d="M60 440L340 278L687 477M132 490L409 330M55 371L403 572" /><ellipse cx="360" cy="470" rx="278" ry="86" />
      </g>
      <motion.g animate={reduce ? {} : { y: [0, -7, 0] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}>
        <path d="M185 228L357 130L558 244L386 344Z" fill="#e9c283" stroke="#9f6c38" strokeWidth="2" />
        <path d="M185 228L386 344V473L185 357Z" fill="#cf9a52" stroke="#9f6c38" strokeWidth="2" />
        <path d="M386 344L558 244V372L386 473Z" fill="#ac7236" stroke="#815126" strokeWidth="2" />
        <path d="M185 228L386 344V473L185 357Z" fill={'url(#' + sceneId + '-wood)'} />
        <path d="M386 344L558 244V372L386 473Z" fill={'url(#' + sceneId + '-wood)'} />
        <path d="M174 217L357 111L572 235L386 344Z" fill="#333b3d" stroke="#10191d" strokeWidth="2" />
        <path d="M174 217V229L386 354L572 247V235L386 344Z" fill="#4c5552" />
        <path d="M287 185L356 145L484 219L415 259Z" fill="#18364c" stroke="#8daab8" strokeWidth="2" />
        <path d="M287 185L356 145L484 219L415 259Z" fill={'url(#' + sceneId + '-solar)'} />
        <path d="M217 367L336 436V447L217 378Z" fill="#352713" />
        <path d="M205 383L343 463L360 452L221 371Z" fill="#e0ad6b" />
        <path d="M388 368L434 341V394L388 421Z" fill="#e6e8df" stroke="#747e72" strokeWidth="2" />
        <path d="M397 370L424 354V383L397 399Z" fill="#243b32" />
        <circle cx="408" cy="377" r="3" fill="#8ac984" />
        <path d="M438 337V276" stroke="#2b392f" strokeWidth="5" strokeLinecap="round" />
        <circle cx="438" cy="271" r="4" fill="#e9ad35" />
        <path d="M442 266Q467 247 484 266M447 254Q467 236 493 253" stroke="#c28926" fill="none" strokeWidth="2" />
        <path d="M237 271L262 285V314L237 300Z" fill="#fff0c6" opacity=".9" />
        <path d="M248 284V299" stroke="#a97021" strokeWidth="3" />
      </motion.g>
      <motion.g animate={{ opacity: compact || stage >= 1 ? 1 : .2, x: compact ? 0 : stage >= 1 ? 0 : 20 }} transition={{ duration: .5 }}>
        <path d="M570 310L650 264Q663 258 663 273V405Q663 414 656 418L580 462Q567 470 567 456V327Q567 316 570 310Z" fill="var(--phone-case)" stroke="var(--text-muted)" strokeWidth="2" />
        <path d="M578 324L651 282V400L578 442Z" fill="var(--surface-solid)" />
        <path d="M588 340L638 311M588 353L628 330M588 399L637 370" stroke="var(--accent-ink)" strokeWidth="3" />
        <path d="M588 380L597 363L608 370L619 348L637 352" stroke="#71a373" strokeWidth="3" fill="none" />
        <circle cx="613" cy="429" r="4" fill="var(--text-muted)" />
        <path d="M465 312Q529 282 568 322" stroke="var(--accent-ink)" strokeWidth="2" strokeDasharray="5 7" fill="none" />
      </motion.g>
      {!compact && <motion.g animate={{ opacity: stage >= 2 ? 1 : .12, y: stage >= 2 ? 0 : -8 }}>
        <path d="M564 132L623 98L690 137L631 172Z" fill="var(--surface-solid)" stroke="var(--text-muted)" />
        <path d="M564 132V190L631 230V172Z" fill="var(--surface-subtle)" stroke="var(--text-muted)" />
        <path d="M631 172L690 137V195L631 230Z" fill="var(--surface-solid)" stroke="var(--text-muted)" />
        {[0, 1, 2].map(i => <path key={i} d={'M578 ' + (151 + i * 15) + 'l37 22'} stroke="var(--accent-ink)" strokeWidth="3" />)}
        <path d="M636 275Q682 249 659 213" stroke="var(--accent-ink)" strokeWidth="2" strokeDasharray="5 7" fill="none" />
        <text x="590" y="81" fill="var(--text-muted)" fontSize="12" fontFamily="monospace">MQTT / CLOUD</text>
      </motion.g>}
      {!compact && <motion.g animate={{ opacity: stage >= 4 ? 1 : .12 }}>
        <path d="M99 135l36-21 36 21v42l-36 21-36-21Z" fill="var(--surface-solid)" stroke="var(--accent-ink)" strokeWidth="2" />
        <path d="M135 129v45M116 141l38 22M116 163l38-22" stroke="var(--accent-ink)" strokeWidth="2" />
        <path d="M171 157Q306 35 560 121" stroke="var(--accent-ink)" strokeDasharray="5 7" fill="none" />
        <text x="72" y="220" fill="var(--text-muted)" fontSize="12" fontFamily="monospace">CHAIN RECORD</text>
      </motion.g>}
      <g fontFamily="monospace" fontSize="12" fill="var(--text-muted)">
        <text x="143" y="525">SENSOR-ENABLED BEE BOX</text><text x="143" y="545" fontSize="10">PRODUCT ILLUSTRATION · NOT LIVE TELEMETRY</text>
      </g>
    </svg>
    <div className="scene-label"><Cpu size={16} /><span>Honey Chain / Field unit 01</span><span className="scene-dot" /></div>
  </div>;
}

export function ProductJourney() {
  const target = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target, offset: ['start start', 'end end'] });
  useMotionValueEvent(scrollYProgress, 'change', value => setActive(Math.min(JOURNEY.length - 1, Math.floor(value * JOURNEY.length))));
  const step = JOURNEY[active];
  const Icon = step.icon;
  return <section id="journey" ref={target} className={'journey-section' + (reduce ? ' journey-reduced' : '')}>
    <div className="journey-sticky">
      <div className="journey-heading"><p className="eyebrow">FOLLOW THE SIGNAL</p><span>Scroll to explore <ArrowDown size={15} /></span></div>
      <div className="journey-layout">
        <div className="journey-copy">
          <p className="journey-tag"><Icon size={18} />{step.tag}</p>
          <motion.h2 key={step.title} initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>{step.title}</motion.h2>
          <p className="journey-description">{step.detail}</p>
          <div className="signal-strip">{step.signal}</div>
          <p className="journey-note">{step.note}</p>
          <div className="journey-steps" aria-label="Explore product stages">{JOURNEY.map((item, i) => <button key={item.tag} type="button" aria-label={item.title} aria-pressed={i === active} className={i === active ? 'is-active' : ''} onClick={() => setActive(i)}>{i + 1}</button>)}</div>
        </div>
        <HiveScene stage={active} />
      </div>
      <div className="journey-progress"><motion.div style={{ scaleX: scrollYProgress, transformOrigin: 'left' }} /></div>
    </div>
  </section>;
}
