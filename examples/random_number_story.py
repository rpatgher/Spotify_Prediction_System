import random


def build_story() -> str:
    nouns = ["playlist", "album", "track", "artist", "listener"]
    actions = ["jumped over", "remixed", "skipped", "saved", "shared"]
    places = ["the studio", "the stage", "the app", "the chart", "the radio"]
    return (
        f"The {random.choice(nouns)} {random.choice(actions)} "
        f"{random.choice(places)}."
    )


if __name__ == "__main__":
    print(build_story())
