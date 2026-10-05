"use client";

import { useMemo, useState } from "react";

type Suit = "♠" | "♥" | "♦" | "♣";
type Rank =
  | "A"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K";

type Card = {
  id: string;
  suit: Suit;
  rank: Rank;
};

type Hand = {
  cards: Card[];
  frozen: boolean;
};

type Team = {
  id: number;
  name: string;
  score: number;
  powerChips: number;
  hands: Hand[];
};

type PendingCard = {
  card: Card;
  earnedByTeamId: number;
} | null;

const QUESTION_POINTS = 100;

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

function createDeck(): Card[] {
  const suits: Suit[] = ["♠", "♥", "♦", "♣"];
  const ranks: Rank[] = [
    "A",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "J",
    "Q",
    "K",
  ];

  const deck = suits.flatMap((suit) =>
    ranks.map((rank) => ({
      id: `${rank}-${suit}-${crypto.randomUUID()}`,
      suit,
      rank,
    }))
  );

  return shuffle(deck);
}

function createHands(): Hand[] {
  return Array.from({ length: 3 }, () => ({
    cards: [],
    frozen: false,
  }));
}

function handValue(cards: Card[]): number {
  let total = 0;
  let aces = 0;

  for (const card of cards) {
    if (card.rank === "A") {
      total += 11;
      aces += 1;
    } else if (["J", "Q", "K"].includes(card.rank)) {
      total += 10;
    } else {
      total += Number(card.rank);
    }
  }

  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }

  return total;
}

function handStatus(hand: Hand) {
  const value = handValue(hand.cards);

  if (value > 21) return "BUST";
  if (value === 21) return "21";
  if (hand.frozen) return "FROZEN";

  return "";
}

function bestHandValue(team: Team): number {
  const surviving = team.hands
    .map((hand) => handValue(hand.cards))
    .filter((value) => value <= 21);

  if (surviving.length === 0) return 0;

  return Math.max(...surviving);
}

function rankedHandValues(team: Team): number[] {
  return team.hands
    .map((hand) => {
      const value = handValue(hand.cards);

      return value > 21 ? -1 : value;
    })
    .sort((a, b) => b - a);
}

function compareTeamsByHands(a: Team, b: Team): number {
  const aValues = rankedHandValues(a);
  const bValues = rankedHandValues(b);

  for (let i = 0; i < 3; i++) {
    if (aValues[i] > bValues[i]) return 1;
    if (aValues[i] < bValues[i]) return -1;
  }

  return 0;
}

function CardView({
  card,
  large = false,
}: {
  card: Card;
  large?: boolean;
}) {
  const red = card.suit === "♥" || card.suit === "♦";

  return (
    <div
      className={`relative flex shrink-0 flex-col justify-between rounded-xl border-2 border-white/80 bg-white font-black shadow-xl ${
        large ? "h-44 w-32 p-3" : "h-24 w-16 p-2"
      } ${red ? "text-red-600" : "text-slate-950"}`}
    >
      <div className={large ? "text-3xl" : "text-lg"}>
        <div>{card.rank}</div>
        <div>{card.suit}</div>
      </div>

      <div className={`self-center ${large ? "text-6xl" : "text-3xl"}`}>
        {card.suit}
      </div>

      <div
        className={`rotate-180 self-end ${
          large ? "text-3xl" : "text-lg"
        }`}
      >
        <div>{card.rank}</div>
        <div>{card.suit}</div>
      </div>
    </div>
  );
}

export default function Home() {
  const [screen, setScreen] = useState<"setup" | "game" | "finished">(
    "setup"
  );

  const [teamCount, setTeamCount] = useState(2);
  const [teams, setTeams] = useState<Team[]>([]);
  const [deck, setDeck] = useState<Card[]>([]);
  const [round, setRound] = useState(1);
  const [pendingCard, setPendingCard] = useState<PendingCard>(null);
  const [lastPlayed, setLastPlayed] = useState<{
  teamId: number;
  handIndex: number;
  card: Card;
} | null>(null);
  const [activeTeamId, setActiveTeamId] = useState<number | null>(null);
  const [message, setMessage] = useState(
    "Choose a team that answered correctly."
  );

  const activeTeam = teams.find((team) => team.id === activeTeamId);

  const overallLeader = useMemo(() => {
    if (teams.length === 0) return null;

    return [...teams].sort((a, b) => b.score - a.score)[0];
  }, [teams]);

  function startGame() {
    const newTeams: Team[] = Array.from(
      { length: teamCount },
      (_, index) => ({
        id: index + 1,
        name: `Team ${index + 1}`,
        score: 0,
        powerChips: 0,
        hands: createHands(),
      })
    );

    setTeams(newTeams);
    setDeck(createDeck());
    setRound(1);
    setPendingCard(null);
    setActiveTeamId(null);
    setMessage("Choose a team that answered correctly.");
    setScreen("game");
  }

  function awardCorrectAnswer(teamId: number) {
    setLastPlayed(null);
    if (pendingCard) {
      setMessage("Place the current card before awarding another answer.");
      return;
    }

    setTeams((current) =>
      current.map((team) =>
        team.id === teamId
          ? { ...team, score: team.score + QUESTION_POINTS }
          : team
      )
    );

    setActiveTeamId(teamId);

    setMessage(
      `Team ${teamId} earned ${QUESTION_POINTS} points. Draw their card.`
    );
  }

  function drawCard() {
    if (!activeTeamId) {
      setMessage("Choose the team that answered correctly first.");
      return;
    }

    if (pendingCard) {
      setMessage("You already have a card waiting to be placed.");
      return;
    }

    let workingDeck = [...deck];

    if (workingDeck.length === 0) {
      workingDeck = createDeck();
    }

    const [card, ...remaining] = workingDeck;

    setDeck(remaining);

    setPendingCard({
      card,
      earnedByTeamId: activeTeamId,
    });

    setMessage(
      `Team ${activeTeamId}: KEEP the card or PASS it to an opponent.`
    );
  }

  function placeCard(teamId: number, handIndex: number) {
    if (!pendingCard) return;

    const targetTeam = teams.find((team) => team.id === teamId);
    const targetHand = targetTeam?.hands[handIndex];

    if (!targetTeam || !targetHand) return;

    const currentValue = handValue(targetHand.cards);

    if (targetHand.frozen || currentValue >= 21) {
      setMessage("That hand is locked. Choose another hand.");
      return;
    }

    const newValue = handValue([
      ...targetHand.cards,
      pendingCard.card,
    ]);

    setTeams((current) =>
      current.map((team) => {
        if (team.id !== teamId) return team;

        return {
          ...team,

          // Exactly 21 earns an immediate Power Chip.
          powerChips:
            newValue === 21
              ? team.powerChips + 1
              : team.powerChips,

          hands: team.hands.map((hand, index) =>
            index === handIndex
              ? {
                  ...hand,
                  cards: [...hand.cards, pendingCard.card],

                  // 21 and Bust permanently lock the hand.
                  frozen: hand.frozen || newValue >= 21,
                }
              : hand
          ),
        };
      })
    );

    setLastPlayed({
  teamId,
  handIndex,
  card: pendingCard.card,
});

    if (newValue > 21) {
      setMessage(
        `💥 BUST! Team ${teamId}, Hand ${
          handIndex + 1
        } busted at ${newValue}!`
      );
    } else if (newValue === 21) {
      setMessage(
        `⚡ CATCH 21! Team ${teamId}, Hand ${
          handIndex + 1
        } earns a POWER CHIP!`
      );
    } else {
      setMessage(
        `Card placed on Team ${teamId}, Hand ${handIndex + 1}.`
      );
    }

    setPendingCard(null);
    setActiveTeamId(null);
  }

  function usePowerChip(teamId: number, handIndex: number) {
  const team = teams.find((team) => team.id === teamId);

  if (!team || team.powerChips <= 0 || !lastPlayed) return;

  if (
    lastPlayed.teamId !== teamId ||
    lastPlayed.handIndex !== handIndex
  ) {
    return;
  }

  let workingDeck = [...deck];

  if (workingDeck.length === 0) {
    workingDeck = createDeck();
  }

  const [replacementCard, ...remainingDeck] = workingDeck;

  const hand = team.hands[handIndex];

  const cardsWithoutLast = hand.cards.filter(
    (card) => card.id !== lastPlayed.card.id
  );

  const replacementCards = [
    ...cardsWithoutLast,
    replacementCard,
  ];

  const newValue = handValue(replacementCards);

  setDeck(remainingDeck);

  setTeams((current) =>
    current.map((currentTeam) => {
      if (currentTeam.id !== teamId) return currentTeam;

      return {
        ...currentTeam,

        powerChips:
          newValue === 21
            ? currentTeam.powerChips
            : currentTeam.powerChips - 1,

        hands: currentTeam.hands.map(
          (currentHand, index) => {
            if (index !== handIndex) return currentHand;

            return {
              ...currentHand,
              cards: replacementCards,
              frozen: newValue >= 21,
            };
          }
        ),
      };
    })
  );

  setLastPlayed(null);

  if (newValue > 21) {
    setMessage(
      `⚡ Power Chip used! Replacement card still busts Team ${teamId}, Hand ${
        handIndex + 1
      } at ${newValue}!`
    );
  } else if (newValue === 21) {
    setMessage(
      `⚡ POWER CHIP MIRACLE! Team ${teamId}, Hand ${
        handIndex + 1
      } hits 21!`
    );
  } else {
    setMessage(
      `⚡ Power Chip used! Team ${teamId}, Hand ${
        handIndex + 1
      } is now ${newValue}.`
    );
  }
}

  function freezeHand(teamId: number, handIndex: number) {
    if (pendingCard) {
      setMessage("Finish placing the current card first.");
      return;
    }

    const targetTeam = teams.find((team) => team.id === teamId);
    const targetHand = targetTeam?.hands[handIndex];

    if (!targetHand) return;

    const value = handValue(targetHand.cards);

    if (
      targetHand.cards.length === 0 ||
      targetHand.frozen ||
      value >= 21
    ) {
      return;
    }

    setTeams((current) =>
      current.map((team) => {
        if (team.id !== teamId) return team;

        return {
          ...team,
          hands: team.hands.map((hand, index) =>
            index === handIndex
              ? {
                  ...hand,
                  frozen: true,
                }
              : hand
          ),
        };
      })
    );

    setMessage(
      `❄ Team ${teamId}, Hand ${handIndex + 1} is FROZEN at ${value}.`
    );
  }

  function changeScore(teamId: number, amount: number) {
    setTeams((current) =>
      current.map((team) =>
        team.id === teamId
          ? {
              ...team,
              score: Math.max(0, team.score + amount),
            }
          : team
      )
    );
  }

  function endRound() {
    if (pendingCard) {
      setMessage("Place the current card before ending the round.");
      return;
    }

    const values = teams.map((team) => ({
      id: team.id,
      value: bestHandValue(team),
    }));

    const highest = Math.max(...values.map((item) => item.value));

    if (highest === 0) {
      setMessage("Everybody busted. No Power Chip awarded.");
      return;
    }

    const winners = values.filter((item) => item.value === highest);

    if (winners.length > 1) {
      setMessage(
        `Round tied at ${highest}. No Power Chip yet — break the tie or continue the round.`
      );
      return;
    }

    const winnerId = winners[0].id;

    setTeams((current) =>
      current.map((team) =>
        team.id === winnerId
          ? {
              ...team,
              powerChips: team.powerChips + 1,
            }
          : team
      )
    );

    setMessage(
      `🏆 Team ${winnerId} wins Round ${round} with ${highest} and earns a Power Chip!`
    );

    setTimeout(() => {
      setTeams((current) =>
        current.map((team) => ({
          ...team,
          hands: createHands(),
        }))
      );

      setDeck(createDeck());
      setRound((current) => current + 1);
      setActiveTeamId(null);
      setPendingCard(null);
      setMessage("New round! Choose the first correct-answer team.");
    }, 2200);
  }

  function endGame() {
    if (pendingCard) {
      setMessage("Place the current card before ending the game.");
      return;
    }

    setScreen("finished");
  }

  function restartGame() {
    setScreen("setup");
    setTeams([]);
    setDeck([]);
    setRound(1);
    setPendingCard(null);
    setActiveTeamId(null);
    setMessage("Choose a team that answered correctly.");
  }

  if (screen === "setup") {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,#123b63_0%,#071827_42%,#020609_100%)] px-6 py-10 text-white">
        <div className="mx-auto flex min-h-[85vh] max-w-5xl items-center justify-center">
          <div className="w-full max-w-3xl rounded-[2rem] border border-cyan-300/20 bg-black/40 p-8 text-center shadow-2xl backdrop-blur md:p-12">
            <div className="mb-3 text-sm font-black tracking-[0.5em] text-cyan-300">
              MR. CEPHAS&apos; GAME SHOW NETWORK
            </div>

            <h1 className="text-6xl font-black tracking-tight md:text-8xl">
              CATCH <span className="text-yellow-300">21</span>
            </h1>

            <p className="mx-auto mt-5 max-w-xl text-lg text-slate-300">
              Answer. Draw. Keep it. Pass it. Freeze it.
              <br />
              Get as close to 21 as you dare.
            </p>

            <div className="mx-auto mt-10 max-w-md rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="mb-4 text-sm font-bold uppercase tracking-[0.25em] text-slate-400">
                Number of Teams
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[2, 3, 4].map((count) => (
                  <button
                    key={count}
                    onClick={() => setTeamCount(count)}
                    className={`rounded-xl border px-5 py-4 text-2xl font-black transition ${
                      teamCount === count
                        ? "border-yellow-300 bg-yellow-300 text-slate-950"
                        : "border-white/15 bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>

              <button
                onClick={startGame}
                className="mt-6 w-full rounded-xl bg-cyan-400 px-6 py-4 text-xl font-black text-slate-950 transition hover:bg-cyan-300"
              >
                START GAME
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (screen === "finished") {
    const sortedTeams = [...teams].sort(
      (a, b) => b.score - a.score
    );

    const winningScore = sortedTeams[0]?.score ?? 0;

    const winners = sortedTeams.filter(
      (team) => team.score === winningScore
    );

    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,#123b63_0%,#071827_42%,#020609_100%)] px-6 py-10 text-white">
        <div className="mx-auto flex min-h-[85vh] max-w-4xl items-center justify-center">
          <div className="w-full rounded-[2rem] border border-yellow-300/30 bg-black/40 p-8 text-center shadow-2xl md:p-12">
            <div className="text-sm font-black tracking-[0.4em] text-cyan-300">
              FINAL RESULTS
            </div>

            <h1 className="mt-3 text-5xl font-black md:text-7xl">
              {winners.length === 1
                ? `${winners[0].name} WINS!`
                : "WE HAVE A TIE!"}
            </h1>

            <div className="mt-10 space-y-3">
              {sortedTeams.map((team, index) => (
                <div
                  key={team.id}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-6 py-4"
                >
                  <div className="text-left">
                    <div className="text-xl font-bold">
                      #{index + 1} {team.name}
                    </div>

                    <div className="text-sm text-slate-400">
                      Power Chips: {team.powerChips}
                    </div>
                  </div>

                  <span className="text-3xl font-black text-yellow-300">
                    {team.score.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={restartGame}
              className="mt-8 rounded-xl bg-cyan-400 px-8 py-4 text-lg font-black text-slate-950"
            >
              PLAY AGAIN
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#123b63_0%,#071827_42%,#020609_100%)] p-4 text-white md:p-6">
      <div className="mx-auto max-w-[1800px]">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/30 px-5 py-4">
          <div>
            <div className="text-xs font-black tracking-[0.35em] text-cyan-300">
              MR. CEPHAS&apos; GAME SHOW NETWORK
            </div>

            <div className="text-3xl font-black">
              CATCH <span className="text-yellow-300">21</span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Round
              </div>

              <div className="text-3xl font-black">{round}</div>
            </div>

            <div className="text-center">
              <div className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Deck
              </div>

              <div className="text-3xl font-black">{deck.length}</div>
            </div>
          </div>
        </header>

        <section className="mb-5 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-5 py-4 text-center">
          <div className="text-lg font-black text-cyan-100">
            {message}
          </div>
        </section>

        <section
          className={`grid gap-4 ${
            teams.length === 2
              ? "lg:grid-cols-2"
              : teams.length === 3
              ? "xl:grid-cols-3"
              : "xl:grid-cols-2"
          }`}
        >
          {teams.map((team) => (
            <div
              key={team.id}
              className={`rounded-2xl border p-4 shadow-xl transition ${
                activeTeamId === team.id
                  ? "border-yellow-300 bg-yellow-300/10"
                  : "border-white/10 bg-black/30"
              }`}
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-2xl font-black">{team.name}</div>

                  <div className="text-sm text-slate-400">
                    Power Chips:{" "}
                    <span className="font-black text-yellow-300">
                      {team.powerChips > 0
                        ? "● ".repeat(team.powerChips)
                        : "0"}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-bold uppercase tracking-widest text-slate-400">
                    Score
                  </div>

                  <div className="text-3xl font-black text-yellow-300">
                    {team.score.toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {team.hands.map((hand, handIndex) => {
                  const value = handValue(hand.cards);
                  const status = handStatus(hand);
                  const locked = hand.frozen || value >= 21;

                  return (
                    <div
                      key={handIndex}
                      className={`min-w-0 rounded-xl border p-2 ${
                        status === "BUST"
                          ? "border-red-500/60 bg-red-950/40"
                          : status === "21"
                          ? "border-yellow-300/60 bg-yellow-300/10"
                          : status === "FROZEN"
                          ? "border-cyan-300/40 bg-cyan-950/30"
                          : "border-white/10 bg-white/5"
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between gap-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 md:text-xs">
                          Hand {handIndex + 1}
                        </span>

                        <span
                          className={`text-sm font-black ${
                            value > 21
                              ? "text-red-400"
                              : value === 21
                              ? "text-yellow-300"
                              : "text-white"
                          }`}
                        >
                          {hand.cards.length === 0 ? "—" : value}
                        </span>
                      </div>

                      {/* OVERLAPPING CARD STACK */}
                      <div className="relative mx-auto h-28 w-full max-w-[150px] overflow-hidden">
                        {hand.cards.length === 0 ? (
                          <div className="absolute left-1/2 top-1 flex h-24 w-16 -translate-x-1/2 items-center justify-center rounded-xl border-2 border-dashed border-white/10 text-2xl text-white/15">
                            ?
                          </div>
                        ) : (
                          hand.cards.map((card, cardIndex) => {
                            const cardWidth = 64;

                            const availableWidth = 145;

                            const spacing =
                              hand.cards.length <= 1
                                ? 0
                                : Math.min(
                                    24,
                                    Math.max(
                                      13,
                                      (availableWidth - cardWidth) /
                                        (hand.cards.length - 1)
                                    )
                                  );

                            const totalWidth =
                              cardWidth +
                              (hand.cards.length - 1) * spacing;

                            const start = Math.max(
                              0,
                              (availableWidth - totalWidth) / 2
                            );

                            return (
                              <div
                                key={card.id}
                                className="absolute top-1 transition-all duration-300"
                                style={{
                                  left: `${
                                    start + cardIndex * spacing
                                  }px`,
                                  zIndex: cardIndex + 1,
                                }}
                              >
                                <CardView card={card} />
                              </div>
                            );
                          })
                        )}
                      </div>

                      <div className="mt-2 min-h-10 text-center text-xs font-black">
                        {status === "BUST" && (
                          <div className="rounded-md bg-red-600 px-1 py-2 text-sm font-black tracking-wider text-white">
                            💥 BUST — {value}
                          </div>
                        )}

                        {status === "21" && (
                          <div className="rounded-md bg-yellow-300 px-1 py-2 text-sm font-black text-slate-950">
                            ⚡ CATCH 21!
                          </div>
                        )}

                        {status === "FROZEN" && (
                          <div className="rounded-md bg-cyan-950/70 px-1 py-2 text-sm font-black text-cyan-300">
                            ❄ FROZEN
                          </div>
                        )}
                      </div>

                      {lastPlayed?.teamId === team.id &&
  lastPlayed?.handIndex === handIndex &&
  team.powerChips > 0 && (
    <button
      onClick={() =>
        usePowerChip(team.id, handIndex)
      }
      className="mt-2 w-full rounded-md bg-purple-500 px-2 py-2 text-xs font-black text-white shadow-lg transition hover:bg-purple-400"
    >
      ⚡ USE POWER CHIP
    </button>
  )}

                      {pendingCard ? (
                        <button
                          onClick={() =>
                            placeCard(team.id, handIndex)
                          }
                          disabled={locked}
                          className="mt-2 w-full rounded-lg bg-cyan-400 px-2 py-2 text-xs font-black text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
                        >
                          {locked ? "LOCKED" : "PLACE HERE"}
                        </button>
                      ) : (
                        <button
                          onClick={() =>
                            freezeHand(team.id, handIndex)
                          }
                          disabled={
                            hand.cards.length === 0 || locked
                          }
                          className="mt-2 w-full rounded-lg border border-white/15 bg-white/5 px-2 py-2 text-xs font-black disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          {hand.frozen ? "FROZEN" : "FREEZE"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <button
                  onClick={() => changeScore(team.id, -100)}
                  className="rounded-lg border border-white/10 bg-white/5 py-2 text-sm font-bold"
                >
                  -100
                </button>

                <button
                  onClick={() => awardCorrectAnswer(team.id)}
                  disabled={!!pendingCard}
                  className="rounded-lg bg-yellow-300 py-2 text-sm font-black text-slate-950 disabled:opacity-40"
                >
                  CORRECT +100
                </button>

                <button
                  onClick={() => changeScore(team.id, 100)}
                  className="rounded-lg border border-white/10 bg-white/5 py-2 text-sm font-bold"
                >
                  +100
                </button>
              </div>
            </div>
          ))}
        </section>

        <section className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto]">
          <div className="flex min-h-56 items-center justify-center rounded-2xl border border-white/10 bg-black/40 p-5">
            {pendingCard ? (
              <div className="flex flex-wrap items-center justify-center gap-6">
                <CardView card={pendingCard.card} large />

                <div>
                  <div className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
                    Card Control
                  </div>

                  <div className="mt-2 text-3xl font-black">
                    Team {pendingCard.earnedByTeamId}
                  </div>

                  <p className="mt-2 max-w-sm text-slate-300">
                    Keep it by placing it on your own hand, or pass
                    it by placing it on an opponent&apos;s available
                    hand.
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center">
                {activeTeam ? (
                  <>
                    <div className="text-sm font-black uppercase tracking-[0.3em] text-yellow-300">
                      {activeTeam.name} Has Control
                    </div>

                    <button
                      onClick={drawCard}
                      className="mt-4 rounded-xl bg-cyan-400 px-10 py-4 text-xl font-black text-slate-950"
                    >
                      DRAW CARD
                    </button>
                  </>
                ) : (
                  <>
                    <div className="text-5xl">🂠</div>

                    <div className="mt-3 text-lg font-bold text-slate-400">
                      Award a correct answer to begin the next play.
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex min-w-64 flex-col gap-3 rounded-2xl border border-white/10 bg-black/40 p-4">
            <div className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">
              Host Controls
            </div>

            <button
              onClick={endRound}
              className="rounded-xl bg-yellow-300 px-6 py-3 font-black text-slate-950"
            >
              END ROUND
            </button>

            <button
              onClick={endGame}
              className="rounded-xl bg-cyan-400 px-6 py-3 font-black text-slate-950"
            >
              END GAME
            </button>

            <button
              onClick={restartGame}
              className="rounded-xl border border-red-400/30 bg-red-950/30 px-6 py-3 font-bold text-red-300"
            >
              RESTART
            </button>

            {overallLeader && (
              <div className="mt-auto rounded-xl bg-white/5 p-3 text-center">
                <div className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  Current Leader
                </div>

                <div className="mt-1 font-black">
                  {overallLeader.name}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}