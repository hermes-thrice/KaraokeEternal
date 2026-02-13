-- Up
CREATE TABLE IF NOT EXISTS "queue_new" (
  "queueId" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  "roomId" integer NOT NULL REFERENCES rooms(roomId) DEFERRABLE INITIALLY DEFERRED,
  "songId" integer,
  "userId" integer NOT NULL REFERENCES users(userId) DEFERRABLE INITIALLY DEFERRED,
  "prevQueueId" INTEGER REFERENCES queue_new(queueId) DEFERRABLE INITIALLY DEFERRED,
  "spotifyTrackId" text,
  "spotifyData" text
);

INSERT INTO queue_new (queueId, roomId, songId, userId, prevQueueId)
  SELECT queueId, roomId, songId, userId, prevQueueId FROM queue;

DROP TABLE queue;
ALTER TABLE queue_new RENAME TO queue;

CREATE INDEX IF NOT EXISTS idxRoom ON "queue" ("roomId" ASC);
CREATE INDEX IF NOT EXISTS idxPrevQueueId ON "queue" ("prevQueueId" ASC);

-- Down
CREATE TABLE IF NOT EXISTS "queue_old" (
  "queueId" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  "roomId" integer NOT NULL REFERENCES rooms(roomId) DEFERRABLE INITIALLY DEFERRED,
  "songId" integer NOT NULL,
  "userId" integer NOT NULL REFERENCES users(userId) DEFERRABLE INITIALLY DEFERRED,
  "prevQueueId" INTEGER REFERENCES queue_old(queueId) DEFERRABLE INITIALLY DEFERRED
);

INSERT INTO queue_old (queueId, roomId, songId, userId, prevQueueId)
  SELECT queueId, roomId, songId, userId, prevQueueId FROM queue WHERE songId IS NOT NULL;

DROP TABLE queue;
ALTER TABLE queue_old RENAME TO queue;

CREATE INDEX IF NOT EXISTS idxRoom ON "queue" ("roomId" ASC);
CREATE INDEX IF NOT EXISTS idxPrevQueueId ON "queue" ("prevQueueId" ASC);
