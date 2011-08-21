// [Jérôme Gravel-Niquet](http://jgn.me/) による Backbone アプリケーションのサンプル。
// このデモはブラウザに Backbone モデルを永続化するためにシンプルな [LocalStorage adapter](backbone-localstorage.html) を使用しています。

// `jQuery.ready` を使用して DOM が作られたタイミングでアプリケーションをロードします:
$(function(){

  // Todo モデル
  // ----------

  // ベーシックなモデルである**Todo** は `text`, `order`, `done` という属性を持ちます
  window.Todo = Backbone.Model.extend({

    // todo アイテムのデフォルトの属性値
    defaults: function() {
      return {
        done:  false,
        order: Todos.nextOrder()
      };
    },

    // todo アイテムの `done` 状態の切り替え
    toggle: function() {
      this.save({done: !this.get("done")});
    }

  });

  // Todo コレクション
  // ---------------

  // todo のコレクションはリモートサーバーの代わりに *localStorage* を使います
  window.TodoList = Backbone.Collection.extend({

    // このコレクションのモデルへの参照
    model: Todo,

    // '"todos"' ネームスペースの下に全ての todo アイテムを保存します
    localStorage: new Store("todos"),

    // 終了した todo アイテムのリストを返すフィルター
    done: function() {
      return this.filter(function(todo){ return todo.get('done'); });
    },

    // 終了していない todo アイテムのリストを返すフィルター
    remaining: function() {
      return this.without.apply(this, this.done());
    },

    // todo には順番がありますが、順序を持たない GUID によってデータベースに保存されます。
    // これは新しい item のために次の番号を生成します。
    nextOrder: function() {
      if (!this.length) return 1;
      return this.last().get('order') + 1;
    },

    // todo は作成順に従ってソートされます
    comparator: function(todo) {
      return todo.get('order');
    }

  });

  // **Todo** のグローバルなコレクションを作成します
  window.Todos = new TodoList;

  // Todo アイテムビュー
  // --------------

  // todo アイテムの DOM エレメント
  window.TodoView = Backbone.View.extend({

    // リストタグ
    tagName:  "li",

    // 単一アイテムのための template 関数のキャッシュ
    template: _.template($('#item-template').html()),

    // アイテム毎の DOM イベント
    events: {
      "click .check"              : "toggleDone",
      "dblclick div.todo-text"    : "edit",
      "click span.todo-destroy"   : "clear",
      "keypress .todo-input"      : "updateOnEnter"
    },

    // TodoView はモデルの変更を監視し、再描画を行います
    initialize: function() {
      this.model.bind('change', this.render, this);
      this.model.bind('destroy', this.remove, this);
    },

    // todo アイテムの内容を再描画します
    render: function() {
      $(this.el).html(this.template(this.model.toJSON()));
      this.setText();
      return this;
    },

    // XSS 対策として (こういったアプリケーションだと脅威とはならないかもしれないけど)、
    // todo アイテムの内容をセットする際に `jQuery.text` を使用しています。
    setText: function() {
      var text = this.model.get('text');
      this.$('.todo-text').text(text);
      this.input = this.$('.todo-input');
      this.input.bind('blur', _.bind(this.close, this)).val(text);
    },

    // モデルの `"done"` 状態を切り替えます
    toggleDone: function() {
      this.model.toggle();
    },

    // このビューを `"editing"` に切り替え、 input フィールドを表示します
    edit: function() {
      $(this.el).addClass("editing");
      this.input.focus();
    },

    // `"editing"` を終了し、その todo への変更を保存します
    close: function() {
      this.model.save({text: this.input.val()});
      $(this.el).removeClass("editing");
    },

    // `enter` を押した場合、 editing を抜けます
    updateOnEnter: function(e) {
      if (e.keyCode == 13) this.close();
    },

    // このビューを DOM から削除します
    remove: function() {
      $(this.el).remove();
    },

    // アイテムを削除し、モデルを破棄します
    clear: function() {
      this.model.destroy();
    }

  });

  // アプリケーション
  // ---------------

  // **AppView** は UI のトップレベルの要素です
  window.AppView = Backbone.View.extend({

    // 新しい HTML 要素を作る代わりに、HTML 中にすでにある既存のスケルトンにバインドします
    el: $("#todoapp"),

    // アプリケーションの下のほうにあるステータス表示のためのテンプレート
    statsTemplate: _.template($('#stats-template').html()),

    // item の作成、完了した item の削除の各イベントをデリゲート
    events: {
      "keypress #new-todo":  "createOnEnter",
      "keyup #new-todo":     "showTooltip",
      "click .todo-clear a": "clearCompleted"
    },

    // 初期化処理で `Todos` コレクションに関連する追加・削除のイベントをバインドします。
    // *localStorage* に保存されている todo をロードします。
    initialize: function() {
      this.input    = this.$("#new-todo");

      Todos.bind('add',   this.addOne, this);
      Todos.bind('reset', this.addAll, this);
      Todos.bind('all',   this.render, this);

      Todos.fetch();
    },

    // 再描画はただステータス表示をリフレッシュするだけです。
    // その他の箇所は変更しません。
    render: function() {
      this.$('#todo-stats').html(this.statsTemplate({
        total:      Todos.length,
        done:       Todos.done().length,
        remaining:  Todos.remaining().length
      }));
    },

    // ビューを作り、`<ul>` にその要素を挿入することで、リストにひとつの item を追加します
    addOne: function(todo) {
      var view = new TodoView({model: todo});
      this.$("#todo-list").append(view.render().el);
    },

    // **Todos** コレクションの全てのアイテムを追加します
    addAll: function() {
      Todos.each(this.addOne);
    },

    // メイン input フィールドでリターンを押したときにテキストを保存するために、
    // 新しい **Todo** モデルを作成し、それを *localStorage* に永続化します
    createOnEnter: function(e) {
      var text = this.input.val();
      if (!text || e.keyCode != 13) return;
      Todos.create({text: text});
      this.input.val('');
    },

    // 全ての完了アイテムをクリアし、それらのモデルを破棄します
    clearCompleted: function() {
      _.each(Todos.done(), function(todo){ todo.destroy(); });
      return false;
    },

    // 新しい todo アイテムを保存するために `enter` を押してください、というツールチップを一秒後に表示します
    showTooltip: function(e) {
      var tooltip = this.$(".ui-tooltip-top");
      var val = this.input.val();
      tooltip.fadeOut();
      if (this.tooltipTimeout) clearTimeout(this.tooltipTimeout);
      if (val == '' || val == this.input.attr('placeholder')) return;
      var show = function(){ tooltip.show().fadeIn(); };
      this.tooltipTimeout = _.delay(show, 1000);
    }

  });

  // 最後に、**App** を作成します
  window.App = new AppView;

});
