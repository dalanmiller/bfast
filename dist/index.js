const adjectives = ['crispy', 'over-easy', 'peanut-buttered', 'honey', 'golden', 'hot', 'fried', 'maple-syrup']
const nouns = ['bacon', 'eggs', 'hash-browns', 'toast', 'waffles', 'pancakes', 'yogurt', 'oatmeal', 'cereal', 'french-toast']

const food_questions_url = 'http://jservice.io/api/category?id=49'

const horizon = Horizon({
    authType: 'anonymous'
})
const games = horizon('games')
const players = horizon('players')
const users = horizon('users')

const Home = Vue.extend({
    methods: {
        createNewGame: () => {
            console.log("Creating new game")
            this.game_name = createNewGameName()

            // Add users' user_id into game document so they can manage it
            horizon.currentUser().fetch().subscribe((result) => {
                // Store the new game
                games.store({
                    id: game_name,
                    current_question: "",
                    user_id: result.id
                }).subscribe((id) => {
                    console.log(id)
                })
            })

            router.go({
                path: `/dashboard/${game_name}`
            })
        }
    }
})

const createNewGameName = () => {
    const game_adjs = _.sample(adjectives, 2)
    const game_noun = _.sample(nouns, 1)
    return `${game_adjs[0]}-${game_adjs[1]}-${game_noun}`
}

const Dashboard = Vue.extend({
    template: `
      <div id="dashboard">
        <div class="col-sm-8">
          <h1>Game: {{ $route.params.game_id }}</h1>
          <progress class="progress progress-info progress-animated" value="{{ completion }}" max="100">0%</progress>
          <p> <a v-link="'{path: "/game/{{$route.params.game_id}}"}'">Link to game: /game/{{ $route.params.game_id }}</a> </p>
          <p> {{ current_question.question }} </p>
          <div id="answer">
            <p> {{ current_question.answer }} </p>
          </div>
          <button class="btn btn-bfast" @click="getNewQuestions">Get new questions</button>
          <button class="btn btn-bfast" @click="nextQuestion">Next question</button>
          <button class="btn btn-bfast" @click="newGame">New game</button>
        </div>
        <div class="col-sm-4">
          <h2> Players </h2>
          <table class="table table-sm">
            <tr v-for="player in players">
              <td v-if="player.name">{{player.name}}</p>
              <td v-else>{{player.id}}</p>
              <td>{{player.score}}</td>
              <td>
                <p v-if="player.answered == 'right'">✅</p>
                <p v-if="player.answered == 'wrong'">❌</p>
                <p v-if="player.answered == 'notyet'">❔</p>
              </td>
            </tr>
          </table>
        </div>
      </div>
    `,
    data: () => {
        return {
            players: [],
            questions: [],
            current_question: "",
            playerSubscription: null,
        }
    },
    created() {
        // Hack
        try {
            const hero = document.querySelector("#intro-hero")
            hero.parentElement.removeChild(hero)
        } catch (e) {
            console.log("whoops")
        }


        // Monitor players for all players in this game
        this.playerSubscription = users.findAll({
            'game_id': this.$route.params.game_id
        }).order('score', 'descending').watch().subscribe((result) => {
            this.players = result
        })

        //Grab food questions
        fetch(food_questions_url).then((response) => {
            return response.json()
        }).then((json) => {

            // Some of the questions have no questions (because parsing?)
            const filtered_questions = json.clues.filter((clue) => {
                return !clue.question == ''
            })

            // Sample just 10 random questions
            this.questions = _.sample(filtered_questions, 10)

            // Set next question if it's empty
            if (_.isEmpty(this.current_question)) {
                this.nextQuestion()
            }
        })
    },
    destroyed() {
        if (this.playerSubscription) {
            this.playerSubscription.unsubscribe()
        }
    },
    computed: {
        completion() {
            console.log(10 - this.questions.length + "0%")
            return 10 - this.questions.length + "0"
        }
    },
    methods: {
        nextQuestion() {
            if (this.questions.length > 0) {
                this.current_question = this.questions.shift()
                    // Set the current_question to the new one
                games.find(this.$route.params.game_id).fetch().subscribe((result) => {
                        console.log(result)
                        result.current_question = this.current_question
                        games.replace(result)
                    })
                    // Unanswer all players
                users.findAll({
                    game_id: this.$route.params.game_id
                }).fetch().subscribe((result) => {
                    for (let i = 0; i < result.length; i++) {
                        result[i].answered = 'notyet'
                    }
                    console.log(result)
                    users.replace(result)
                })
            }
        },
        newGame() {
            // Generate new game_id
            const new_game_name = createNewGameName()

            // Set game manager to have new game_id
            horizon.currentUser().fetch().subscribe((result) => {
                // Store new game in Horizon with user_id
                games.store({
                    id: new_game_name,
                    current_question: "",
                    user_id: result.id
                })
            })

            // Move all current players into new game
            users.findAll({
                game_id: this.$route.params.game_id
            }).fetch().subscribe((result) => {
                result.forEach((player) => {
                    player.game_id = new_game_name
                })
                users.replace(result)
            })

            // Remove original game
            games.remove(this.$route.params.game_id)

            //Route to new game
            router.go({
                path: `/dashboard/${new_game_name}`
            })
        }
    }
})

const Contestant = Vue.extend({
    template: `
      <div id="contestant">
        <div class="col-sm-8">
          <p>Your name: {{ name }} <input @keyup.enter="saveName"></input></p>

          <h2 id="question">{{ current_question.question }}</h2>
          <div id="answer" class="center-block text-xs-center">
            What is <input @keyup.enter="isRight" type="text"></input>?
          </div>
        </div>
        <div id="player-table" class="col-sm-4">
          <h2>Players</h2>
          <table class="table table-sm">
            <tr v-for="player in players">
              <td v-if="player.name">{{player.name}}</p>
              <td v-else>{{player.id}}</p>
              <td>{{player.score}}</td>
              <td>
                <p v-if="player.answered == 'right'">✅</p>
                <p v-if="player.answered == 'wrong'">❌</p>
                <p v-if="player.answered == 'notyet'">❔</p>
              </td>
            </tr>
          </table>
        </div>
      </div>
    `,
    data: () => {
        return {
            name: '',
            current_question: '',
            players: [],
        }
    },
    created() {
        // Hack
        try {
            const hero = document.querySelector("#intro-hero")
            hero.parentElement.removeChild(hero)
        } catch (e) {}

        // When new question is added update question text and allow new input
        this.q_sub = games.find(this.$route.params.game_id).watch().subscribe((result) => {
            if (result) {
                this.current_question = result.current_question
                this.inputSwitcher(false)
            } else {
                console.log("Result was null")
            }
        })

        // Monitor players currently in this game
        this.players_sub = users.findAll({
            game_id: this.$route.params.game_id
        }).order('score', 'descending').watch().subscribe((result) => {
            this.players = result
        })

        // Set current user state to join this game
        horizon.currentUser().fetch().subscribe((result) => {

            users.find(result.id).fetch().subscribe((player) => {
                // Add player.id to this instance context
                this.id = player.id
                this.name = player.name
                    // Set player game_id to this game_id
                player.game_id = this.$route.params.game_id
                    // Set player score to 0 if it doesn't exist
                if (!player.score) {
                    player.score = 0
                }
                if (player.answered != 'notyet') {
                    this.inputSwitcher(true)
                } else {
                    this.inputSwitcher(false)
                }

                users.upsert(player).subscribe((result) => {

                    // Monitor if moving to new game
                    this.player_sub = users.find(result.id).watch().subscribe((player) => {
                        if (player.game_id !== this.$route.params.game_id && player.game_id != null) {
                            console.log(`Moving to new game ${player.game_id}`)
                            router.go({
                                path: `/game/${player.game_id}`
                            })
                        }
                    })
                })
            })
        })
    },
    destroyed() {
        this.q_sub.unsubscribe()
        this.players_sub.unsubscribe()
        this.player_sub.unsubscribe()
        users.find(this.id).fetch().subscribe((player) => {
            player.game_id = null
            users.replace(player)
        })
    },
    methods: {
        isRight(event) {
            if (this.current_question.answer.toLowerCase() == event.target.value.toLowerCase()) {
                console.log("RIGHT")
                users.find(this.id).fetch().subscribe((player) => {
                    // Increment their score
                    player.score += this.current_question.value
                        // Set their answer as true
                    player.answered = 'right'
                    users.replace(player)
                })

                this.inputSwitcher(true)
                    // this.updateScore()
                    // this.notifyCorrect()
            } else {
                console.log("WRONG")

                users.find(this.id).fetch().subscribe((player) => {
                        // Set their answer to false
                        player.answered = 'wrong'
                        users.replace(player)
                    })
                    // this.notifyWrong()
                this.inputSwitcher(true)
            }
            // this.disableInput()
        },
        saveName(event) {
            console.log(event.target.value)
            this.name = event.target.value
            users.find(this.id).fetch().subscribe((result) => {
                result.name = event.target.value
                users.replace(result).subscribe((result) => {
                    console.log(result)
                })
            })
        },
        updateScore() {
            users.find(this.id).fetch().subscribe((result) => {
                if (result.hasOwnProperty('score')) {
                    result.score += this.current_question.value
                } else {
                    result.score = this.current_question.value
                }
            })
        },
        inputSwitcher(state) {
            document.querySelector("#answer input").disabled = state
        }
    }

})

let router = new VueRouter()

router.map({
    // '/': {
    //   component: Home
    // },
    '/dashboard/:game_id': {
        // name: 'game.dashboard',
        component: Dashboard
    },
    '/game/:game_id': {
        // name: 'game.questions',
        component: Contestant
    }
})

router.start(Home, '#bfast-app', () => {
    console.log("App initial render complete")
})
